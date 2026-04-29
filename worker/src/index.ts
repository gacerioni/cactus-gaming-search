/**
 * Cloudflare Worker - Cactus Gaming Search
 * Full search backend: Redis Cloud direct + OpenAI embeddings
 * No EC2 needed — all logic runs at the edge.
 */

import Redis from 'ioredis';
import OpenAI from 'openai';

interface Env {
  REDIS_URL: string;
  OPENAI_API_KEY: string;
  CORS_ORIGIN: string;
  ENVIRONMENT: string;
}

// ─── Constants ────────────────────────────────────────────
const INDEX_NAME = 'idx:jogos';
const HYBRID_CONFIG = {
  alpha: 0.7,        // FTS (BM25) weight in FT.HYBRID LINEAR
  beta: 0.3,         // Vector similarity weight in FT.HYBRID LINEAR
  popWeight: 0.05,   // Popularity tiebreaker weight
  spellcheckDist: 2, // Levenshtein distance for FT.SPELLCHECK
  limit: 20,         // Max results to return
  minScore: 0.01,    // Minimum hybrid score to include
};

// ─── CORS ─────────────────────────────────────────────────
function corsHeaders(): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: any, status = 200): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders() },
  });
}

// ─── Redis connection (per-request) ──────────────────────
function getRedis(env: Env): Redis {
  const isTLS = env.REDIS_URL.startsWith('rediss://');
  return new Redis(env.REDIS_URL, {
    ...(isTLS ? { tls: {} } : {}),
    lazyConnect: true,
    connectTimeout: 5000,
    commandTimeout: 5000,
    maxRetriesPerRequest: 1,
  });
}

// ─── Parser utils ─────────────────────────────────────────
function parseAutocompleteResults(results: any[]): any[] {
  if (!results || results.length === 0) return [];
  const suggestions: any[] = [];
  for (let i = 0; i < results.length; i += 3) {
    if (i + 2 < results.length) {
      suggestions.push({ text: results[i], score: parseFloat(results[i + 1]), id_jogo: results[i + 2] });
    }
  }
  return suggestions;
}

// ─── FT.SPELLCHECK: correct typos before searching ───────
// Stopwords that should never be "corrected" by spellcheck
const STOPWORDS = new Set(['of', 'the', 'do', 'da', 'de', 'e', 'x', 'vs', 'em', 'no', 'na', 'ao', 'os', 'as', 'um', 'uma']);

async function spellcheck(redis: Redis, query: string): Promise<string> {
  try {
    // Try distance 1 first (precise corrections), fallback to 2 for uncorrected terms
    const result1 = await redis.call('FT.SPELLCHECK', INDEX_NAME, query, 'DISTANCE', '1') as any[];

    let corrected = query;
    const correctedTerms = new Set<string>();

    // Pass 1: distance 1 (high confidence)
    for (const item of result1) {
      if (!Array.isArray(item) || item.length < 3) continue;
      const original = String(item[1]);
      const suggestions = item[2] as any[];
      if (!suggestions || suggestions.length === 0) continue;
      if (STOPWORDS.has(original.toLowerCase())) continue;
      const bestSuggestion = String(suggestions[0][1]);
      if (bestSuggestion === original) continue;
      corrected = corrected.replace(original, bestSuggestion);
      correctedTerms.add(original);
    }

    // Pass 2: distance 2 only for terms not corrected in pass 1
    const remaining = query.split(/\s+/).filter(t => !correctedTerms.has(t) && !STOPWORDS.has(t.toLowerCase()) && t.length >= 3);
    if (remaining.length > 0) {
      const result2 = await redis.call('FT.SPELLCHECK', INDEX_NAME, remaining.join(' '), 'DISTANCE', '2') as any[];
      for (const item of result2) {
        if (!Array.isArray(item) || item.length < 3) continue;
        const original = String(item[1]);
        const suggestions = item[2] as any[];
        if (!suggestions || suggestions.length === 0) continue;
        if (STOPWORDS.has(original.toLowerCase())) continue;
        // At distance 2, prefer suggestions closest to original (shortest edit distance)
        // Sort by length difference to original as a proxy for edit closeness
        const ranked = suggestions
          .map((s: any) => ({ term: String(s[1]), freq: parseFloat(s[0]) || 0 }))
          .filter((s: any) => s.term !== original)
          .sort((a: any, b: any) => Math.abs(a.term.length - original.length) - Math.abs(b.term.length - original.length));
        if (ranked.length > 0) {
          corrected = corrected.replace(original, ranked[0].term);
        }
      }
    }

    return corrected;
  } catch (e) {
    console.warn('Spellcheck failed:', e);
    return query;
  }
}

// ─── FT.HYBRID: single-command text + vector search ──────
// Returns: [total_results, N, results, [...games...], warnings, [], execution_time, ms]
// Each game in results is: [__key, id, __score, score, field, val, ...]
const LOAD_FIELDS = ['@nome', '@provider', '@aliases', '@categoria', '@image', '@rtp', '@slug', '@popularity'];

function parseHybridResults(result: any[]): any[] {
  // FT.HYBRID returns: [total_results, N, results, [game1, game2, ...], warnings, [], execution_time, X]
  if (!result || result.length < 4) return [];
  const games = result[3] as any[][];
  if (!games || !Array.isArray(games)) return [];

  return games.map(g => {
    const gd: Record<string, any> = {};
    for (let j = 0; j < g.length; j += 2) {
      const key = typeof g[j] === 'string' ? g[j] : (g[j] as Buffer).toString();
      let val = typeof g[j + 1] === 'string' ? g[j + 1] : (g[j + 1] as Buffer).toString();
      // Parse JSON fields (aliases)
      if (typeof val === 'string' && (val.startsWith('{') || val.startsWith('['))) {
        try { val = JSON.parse(val); } catch (_e) { /* keep string */ }
      }
      gd[key] = val;
    }
    return gd;
  });
}

async function hybridSearch(redis: Redis, query: string, env: Env, filters?: any): Promise<{
  games: any[];
  correctedQuery: string;
  methods: string[];
  spellcheckMs: number;
  hybridMs: number;
}> {
  const methods: string[] = [];

  // Step 1: Spellcheck (correct typos)
  const spellStart = Date.now();
  const correctedQuery = await spellcheck(redis, query);
  const spellcheckMs = Date.now() - spellStart;
  if (correctedQuery !== query) methods.push('spellcheck');

  // Step 2: Generate embedding for semantic search (use ORIGINAL query to preserve intent)
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const embResp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
  const embedding = embResp.data[0].embedding;
  const buf = Buffer.allocUnsafe(embedding.length * 4);
  embedding.forEach((v, i) => buf.writeFloatLE(v, i * 4));

  // Step 3: FT.HYBRID — single command: BM25 text search + vector similarity
  const hybridStart = Date.now();
  const searchQuery = correctedQuery;
  const args: any[] = [
    'FT.HYBRID', INDEX_NAME,
    'SEARCH', searchQuery,
    'YIELD_SCORE_AS', 'text_score',
    'VSIM', '@description_vector', '$vec',
    'COMBINE', 'LINEAR', 6,
    'ALPHA', HYBRID_CONFIG.alpha,
    'BETA', HYBRID_CONFIG.beta,
    'YIELD_SCORE_AS', 'hybrid_score',
    'LOAD', LOAD_FIELDS.length, ...LOAD_FIELDS,
    'PARAMS', 2, 'vec', buf,
  ];

  const result = await redis.call(...args) as any[];
  const hybridMs = Date.now() - hybridStart;
  methods.push('hybrid');

  // Parse results
  let games = parseHybridResults(result);

  // Apply popularity boost as tiebreaker
  const maxHybrid = games.length > 0
    ? Math.max(...games.map(g => parseFloat(g.hybrid_score || g.__score || '0')))
    : 1;

  games = games.map(g => {
    const hybridScore = parseFloat(g.hybrid_score || g.__score || '0');
    const textScore = parseFloat(g.text_score || '0');
    const popularity = Math.min(parseInt(g.popularity || '0', 10), 100) / 100;

    // Normalize hybrid score to 0-1, then add small popularity boost
    const normalized = maxHybrid > 0 ? hybridScore / maxHybrid : 0;
    const finalScore = Math.min(normalized * (1 - HYBRID_CONFIG.popWeight) + popularity * HYBRID_CONFIG.popWeight, 1.0);

    return {
      ...g,
      score: finalScore,
      _debug: { textScore, hybridScore, popularity, normalized, finalScore },
    };
  });

  // Sort by final score, filter, limit
  games = games
    .filter(g => g.score >= HYBRID_CONFIG.minScore)
    .sort((a, b) => b.score - a.score)
    .slice(0, HYBRID_CONFIG.limit);

  // Clean internal fields
  games.forEach(g => {
    delete g.__key;
    delete g.__score;
    delete g.text_score;
    delete g.hybrid_score;
  });

  return { games, correctedQuery, methods, spellcheckMs, hybridMs };
}

// ─── Route: POST /api/search ──────────────────────────────
async function handleSearch(body: any, env: Env): Promise<Response> {
  const { query, filters } = body || {};
  if (!query) return json({ error: 'Query is required' }, 400);

  const startTime = Date.now();
  const redis = getRedis(env);
  await redis.connect();

  try {
    const { games, correctedQuery, methods, spellcheckMs, hybridMs } = await hybridSearch(redis, query, env, filters);

    return json({
      query,
      correctedQuery: correctedQuery !== query ? correctedQuery : undefined,
      filters: filters || {},
      total: games.length,
      results: games,
      games,
      searchMethods: methods,
      executionTime: Date.now() - startTime,
      timing: { spellcheckMs, hybridMs, totalMs: Date.now() - startTime },
    });
  } finally { redis.disconnect(); }
}

// ─── Route: GET /api/autocomplete ─────────────────────────
async function handleAutocomplete(query: string, env: Env): Promise<Response> {
  if (!query || query.length < 2) return json({ suggestions: [] });

  const redis = getRedis(env);
  await redis.connect();
  try {
    const results = await redis.call('FT.SUGGET', 'ac:jogos', query, 'FUZZY', 'MAX', '10', 'WITHSCORES', 'WITHPAYLOADS') as any[];
    return json({ suggestions: parseAutocompleteResults(results) });
  } finally { redis.disconnect(); }
}

// ─── Route: GET /api/categories ───────────────────────────
async function handleCategories(env: Env): Promise<Response> {
  const redis = getRedis(env);
  await redis.connect();
  try {
    const results = await redis.call(
      'FT.AGGREGATE', INDEX_NAME,
      '*',
      'GROUPBY', '1', '@categoria',
      'REDUCE', 'COUNT', '0', 'AS', 'count',
      'SORTBY', '2', '@count', 'DESC'
    ) as any[];

    const categories: any[] = [];
    // FT.AGGREGATE returns: [count, ['categoria', 'slot', 'count', '73'], ...]
    for (let i = 1; i < results.length; i++) {
      const row = results[i] as string[];
      const cat: any = {};
      for (let j = 0; j < row.length; j += 2) {
        cat[row[j]] = row[j + 1];
      }
      if (cat.categoria) {
        categories.push({ name: cat.categoria, count: parseInt(cat.count || '0') });
      }
    }
    return json({ categories });
  } finally { redis.disconnect(); }
}

// ─── Route: POST /api/vector-search ───────────────────────
async function handleVectorSearch(body: any, env: Env): Promise<Response> {
  const { query } = body || {};
  if (!query) return json({ error: 'Query is required' }, 400);

  const redis = getRedis(env);
  await redis.connect();
  try {
    // Vector-only search via FT.HYBRID with alpha=0 (pure vector)
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const embResp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
    const embedding = embResp.data[0].embedding;
    const buf = Buffer.allocUnsafe(embedding.length * 4);
    embedding.forEach((v: number, i: number) => buf.writeFloatLE(v, i * 4));

    const result = await redis.call(
      'FT.HYBRID', INDEX_NAME,
      'SEARCH', '*',
      'VSIM', '@description_vector', '$vec',
      'COMBINE', 'LINEAR', 4, 'ALPHA', 0.0, 'BETA', 1.0,
      'LOAD', LOAD_FIELDS.length, ...LOAD_FIELDS,
      'PARAMS', 2, 'vec', buf,
    ) as any[];

    const games = parseHybridResults(result);
    return json({ query, total: games.length, games, method: 'vector_search', model: 'text-embedding-3-small' });
  } finally { redis.disconnect(); }
}

// ─── Main Router ──────────────────────────────────────────
export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders() });
    }

    try {
      // Health
      if (url.pathname === '/health') {
        return json({ status: 'ok', worker: 'cactus-worker', architecture: 'edge-direct', timestamp: new Date().toISOString() });
      }

      // Autocomplete
      if (url.pathname === '/api/autocomplete' && request.method === 'GET') {
        return handleAutocomplete(url.searchParams.get('q') || '', env);
      }

      // Categories
      if (url.pathname === '/api/categories' && request.method === 'GET') {
        return handleCategories(env);
      }

      // Hybrid Search
      if (url.pathname === '/api/search' && request.method === 'POST') {
        const body = await request.json();
        return handleSearch(body, env);
      }

      // Vector Search
      if (url.pathname === '/api/vector-search' && request.method === 'POST') {
        const body = await request.json();
        return handleVectorSearch(body, env);
      }

      return json({ error: 'Not Found', path: url.pathname }, 404);
    } catch (error: any) {
      console.error('Worker error:', error?.message, error?.stack);
      return json({ error: 'Internal Error', message: error?.message || String(error), stack: error?.stack?.split('\n').slice(0, 5) }, 500);
    }
  },
};