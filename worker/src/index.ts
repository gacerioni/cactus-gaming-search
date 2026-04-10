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
const SEARCH_CONFIG = {
  weights: { fts: 1.0, fuzzy: 0.7, vector: 0.3, aliasBoost: 0.5 },
  limits: { fts: 20, fuzzy: 20, vector: 20, final: 20 },
  minScore: 0.05,
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

// ─── Parser utils (ported from backend/src/utils/parser.ts) ──
function parseSearchResults(results: any[]): any[] {
  if (!results || results.length === 0 || results[0] === 0) return [];
  const games: any[] = [];
  const EXCLUDED = new Set(['description_vector']);
  let i = 1;
  while (i < results.length) {
    const key = results[i++];
    if (i < results.length) {
      const fields = results[i++];
      const game: any = { key };
      for (let j = 0; j < fields.length; j += 2) {
        if (j + 1 < fields.length) {
          const fn = fields[j];
          if (EXCLUDED.has(fn)) continue;
          let fv = fields[j + 1];
          if (typeof fv === 'string' && (fv.startsWith('{') || fv.startsWith('['))) {
            try { fv = JSON.parse(fv); } catch (_e) { /* keep string */ }
          }
          game[fn] = fv;
        }
      }
      games.push(game);
    }
  }
  return games;
}

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

// ─── Scoring (ported from backend/src/services/scoring.service.ts) ──
function positionScore(pos: number, total: number): number {
  if (total === 0) return 0;
  return Math.exp(-3 * pos / total);
}

function combineAndScore(fts: any[], fuzzy: any[], vector: any[]): any[] {
  const map = new Map<string, any>();
  const w = SEARCH_CONFIG.weights;

  const process = (results: any[], source: string, weight: number) => {
    results.forEach((r: any, idx: number) => {
      const id = r.key || r.id;
      const score = positionScore(idx, results.length) * weight;
      if (!map.has(id)) {
        map.set(id, { ...r, _scores: { [source]: score }, finalScore: 0 });
      } else {
        const existing = map.get(id);
        existing._scores[source] = Math.max(existing._scores[source] || 0, score);
      }
    });
  };

  process(fts, 'fts', w.fts);
  process(fuzzy, 'fuzzy', w.fuzzy);
  process(vector, 'vector', w.vector);

  // Calculate final scores
  for (const r of map.values()) {
    r.finalScore = Object.values(r._scores as Record<string, number>).reduce((a: number, b: number) => a + b, 0);
    r.finalScore = Math.min(r.finalScore, 1.0);
    r.score = r.finalScore;
    delete r._scores;
  }

  return Array.from(map.values())
    .filter(r => r.finalScore >= SEARCH_CONFIG.minScore)
    .sort((a, b) => b.finalScore - a.finalScore)
    .slice(0, SEARCH_CONFIG.limits.final);
}

// ─── Filter builder ───────────────────────────────────────
function buildFilterPrefix(filters?: any): string {
  if (!filters?.categoria) return '';
  const cat = filters.categoria.replace(/[^a-zA-Z0-9_àáâãéêíóôõúç]/g, '\\$&');
  return `@categoria:{${cat}} `;
}

// ─── Search functions ─────────────────────────────────────
async function ftsSearch(redis: Redis, query: string, filters?: any): Promise<any[]> {
  try {
    const fp = buildFilterPrefix(filters);
    const q = fp ? `(${fp}) ${query}` : query;
    const results = await redis.call('FT.SEARCH', INDEX_NAME, q, 'LIMIT', '0', String(SEARCH_CONFIG.limits.fts)) as any[];
    return parseSearchResults(results);
  } catch (e) { console.warn('FTS failed:', e); return []; }
}

async function fuzzySearch(redis: Redis, query: string, filters?: any): Promise<any[]> {
  try {
    const terms = query.split(/\s+/).filter(t => t.length > 2);
    const fuzzyTerms = new Set<string>();
    terms.forEach(t => {
      fuzzyTerms.add(`*${t}*`);
      if (t.length >= 5) fuzzyTerms.add(`*${t.substring(0, Math.floor(t.length * 0.6))}*`);
    });
    const fuzzyQuery = Array.from(fuzzyTerms).join(' | ');
    if (!fuzzyQuery) return [];
    const fp = buildFilterPrefix(filters);
    const q = fp ? `(${fp}) (${fuzzyQuery})` : fuzzyQuery;
    const results = await redis.call('FT.SEARCH', INDEX_NAME, q, 'LIMIT', '0', String(SEARCH_CONFIG.limits.fuzzy)) as any[];
    return parseSearchResults(results);
  } catch (e) { console.warn('Fuzzy failed:', e); return []; }
}

async function vectorSearch(redis: Redis, query: string, env: Env, filters?: any): Promise<any[]> {
  try {
    const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
    const embResp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
    const embedding = embResp.data[0].embedding;

    const buf = Buffer.allocUnsafe(embedding.length * 4);
    embedding.forEach((v, i) => buf.writeFloatLE(v, i * 4));

    const fp = buildFilterPrefix(filters);
    const knnQ = fp
      ? `(${fp})=>[KNN ${SEARCH_CONFIG.limits.vector} @description_vector $vec AS score]`
      : `*=>[KNN ${SEARCH_CONFIG.limits.vector} @description_vector $vec AS score]`;

    const results = await redis.call(
      'FT.SEARCH', INDEX_NAME, knnQ,
      'PARAMS', '2', 'vec', buf,
      'RETURN', '8', 'nome', 'provider', 'aliases', 'categoria', 'image', 'rtp', 'slug', 'score',
      'SORTBY', 'score', 'DIALECT', '2'
    ) as any[];
    return parseSearchResults(results);
  } catch (e) { console.warn('Vector failed:', e); return []; }
}

// ─── Route: POST /api/search ──────────────────────────────
async function handleSearch(body: any, env: Env): Promise<Response> {
  const { query, filters } = body || {};
  if (!query) return json({ error: 'Query is required' }, 400);

  const startTime = Date.now();
  const redis = getRedis(env);
  await redis.connect();

  try {
    const [ftsR, fuzzyR, vectorR] = await Promise.allSettled([
      ftsSearch(redis, query, filters),
      fuzzySearch(redis, query, filters),
      vectorSearch(redis, query, env, filters),
    ]);

    const fts = ftsR.status === 'fulfilled' ? ftsR.value : [];
    const fuzzy = fuzzyR.status === 'fulfilled' ? fuzzyR.value : [];
    const vector = vectorR.status === 'fulfilled' ? vectorR.value : [];

    const methods: string[] = [];
    if (fts.length) methods.push('fts');
    if (fuzzy.length) methods.push('fuzzy');
    if (vector.length) methods.push('vector');

    const games = combineAndScore(fts, fuzzy, vector);

    return json({
      query, filters: filters || {}, total: games.length,
      games, searchMethods: methods, executionTime: Date.now() - startTime,
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
  const { query, k } = body || {};
  if (!query) return json({ error: 'Query is required' }, 400);

  const redis = getRedis(env);
  await redis.connect();
  try {
    const results = await vectorSearch(redis, query, env);
    return json({ query, total: results.length, games: results, method: 'vector_search', model: 'text-embedding-3-small' });
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
      const isDev = env.ENVIRONMENT === 'development';
      return json({
        error: 'Internal Error',
        message: isDev ? (error?.message || String(error)) : undefined,
      }, 500);
    }
  },
};
