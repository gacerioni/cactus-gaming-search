/**
 * Cloudflare Worker - Cactus Gaming Search
 * Edge API direct to Redis Cloud: autocomplete, spellcheck, cached embeddings,
 * FT.HYBRID, filters, intent boosts and lightweight observability.
 */

import Redis from 'ioredis';
import OpenAI from 'openai';

interface Env {
  REDIS_URL: string;
  OPENAI_API_KEY: string;
  CORS_ORIGIN?: string;
  ENVIRONMENT?: string;
}

type Filters = {
  categoria?: string;
  provider?: string;
};

type SearchIntent = {
  id: string;
  term: string;
  normalized: string;
  canonical: string;
  id_jogo: string;
  intent: string;
  categoria: string;
  provider: string;
  rewrite: string;
  boost: string;
};

type Timing = Record<string, number>;

const INDEX_NAME = 'idx:jogos';
const AUTOCOMPLETE_KEY = 'ac:jogos';
const PROTECTED_SPELL_DICT = 'dict:search_protected';
const METRICS_CACHE_MS = 5000;
let metricsCache: { expiresAt: number; payload: Record<string, unknown> } | null = null;
const CACHE_VERSION = '2026-04-cactus-demo-v4';

const SEARCH_CONFIG = {
  limit: 20,
  vectorK: 40,
  efRuntime: 120,
  minScore: 0.01,
  rrfWindow: 60,
  rrfConstant: 20,
  popularityWeight: 0.03,
  searchCacheShortTtlSeconds: 60 * 60,
  searchCacheDefaultTtlSeconds: 5 * 60,
  embeddingCacheTtlSeconds: 60 * 60 * 24 * 7,
  timeoutMs: 80,
};

const LOAD_FIELDS = [
  '@id_jogo',
  '@nome',
  '@provider',
  '@aliases',
  '@categoria',
  '@description',
  '@image',
  '@rtp',
  '@slug',
  '@tags',
  '@popularity',
];

const STOPWORDS = new Set(['of', 'the', 'do', 'da', 'de', 'e', 'x', 'vs', 'em', 'no', 'na', 'ao', 'os', 'as', 'um', 'uma']);
const PROTECTED_TERMS = new Set([
  'aovivo',
  'black',
  'jack',
  'hoje',
  'futebol',
  'alguma',
  'algo',
  'coisa',
  'velho',
  'velhinho',
  'zeus',
  'netuno',
  'poseidon',
  'aviator',
  'aviaozinho',
  'tigrinho',
  'triguinho',
  'roletinha',
]);

function corsHeaders(env?: Env): Record<string, string> {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    'Access-Control-Max-Age': '86400',
  };
}

function json(data: unknown, status = 200, env?: Env): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { 'Content-Type': 'application/json', ...corsHeaders(env) },
  });
}

function getRedis(env: Env): Redis {
  const isTLS = env.REDIS_URL.startsWith('rediss://');
  return new Redis(env.REDIS_URL, {
    ...(isTLS ? { tls: {} } : {}),
    lazyConnect: true,
    connectTimeout: 3000,
    commandTimeout: 3000,
    maxRetriesPerRequest: 1,
  });
}

async function ensureRedis(redis: Redis, timing?: Timing): Promise<void> {
  const start = Date.now();
  if (redis.status === 'wait' || redis.status === 'end' || redis.status === 'close') {
    await redis.connect();
  }
  if (timing) timing.redisConnectMs = Date.now() - start;
}

function releaseRedis(_redis: Redis): void {
  _redis.disconnect();
}

function normalizeQuery(value: string): string {
  return (value || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
    .replace(/\s+/g, ' ');
}

function isShortTail(normalized: string, intent?: SearchIntent | null): boolean {
  return Boolean(intent) || normalized.split(/\s+/).filter(Boolean).length <= 3;
}

async function sha256Hex(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input));
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

async function keyFor(prefix: string, payload: unknown): Promise<string> {
  return `${prefix}:${CACHE_VERSION}:${await sha256Hex(JSON.stringify(payload))}`;
}

function toStringValue(value: unknown): string {
  if (value == null) return '';
  if (typeof value === 'string') return value;
  if (Buffer.isBuffer(value)) return value.toString();
  return String(value);
}

function parseAutocompleteResults(results: unknown[]): unknown[] {
  if (!results || results.length === 0) return [];
  const suggestions = [];
  for (let i = 0; i < results.length; i += 3) {
    if (i + 2 < results.length) {
      suggestions.push({
        text: toStringValue(results[i]),
        score: parseFloat(toStringValue(results[i + 1])),
        id_jogo: toStringValue(results[i + 2]),
      });
    }
  }
  return suggestions;
}

function parseHybridResults(result: unknown[]): Record<string, unknown>[] {
  if (!result || result.length < 4) return [];
  const rows = result[3] as unknown[][];
  if (!Array.isArray(rows)) return [];

  return rows.map(row => {
    const game: Record<string, unknown> = {};
    for (let j = 0; j < row.length; j += 2) {
      const key = toStringValue(row[j]).replace(/^@/, '');
      let value: unknown = toStringValue(row[j + 1]);

      if (typeof value === 'string' && (value.startsWith('{') || value.startsWith('['))) {
        try { value = JSON.parse(value); } catch (_e) { /* keep string */ }
      }
      game[key] = value;
    }
    return game;
  });
}

function parseInfo(info: string): Record<string, string> {
  const out: Record<string, string> = {};
  for (const line of info.split('\r\n')) {
    if (!line || line.startsWith('#')) continue;
    const idx = line.indexOf(':');
    if (idx > 0) out[line.slice(0, idx)] = line.slice(idx + 1);
  }
  return out;
}

function redisArrayToObject(arr: unknown[]): Record<string, unknown> {
  const obj: Record<string, unknown> = {};
  for (let i = 0; i < arr.length; i += 2) {
    obj[toStringValue(arr[i])] = arr[i + 1];
  }
  return obj;
}

function escapeTagValue(value: string): string {
  return value.replace(/([\\{}|,\s])/g, '\\$1');
}

function buildFilterExpression(filters?: Filters): string {
  const parts: string[] = [];
  if (filters?.categoria) parts.push(`@categoria:{${escapeTagValue(filters.categoria)}}`);
  if (filters?.provider) parts.push(`@provider:{${escapeTagValue(filters.provider)}}`);
  return parts.join(' ');
}

function escapeTextTerm(value: string): string {
  return value.replace(/([\\[\]{}():|&!~"'])/g, '\\$1');
}

function intentSearchExpression(intent: SearchIntent): string {
  const terms = normalizeQuery(intent.rewrite || intent.canonical)
    .split(/\s+/)
    .filter(term => term.length > 1 && !STOPWORDS.has(term));

  const unique = Array.from(new Set(terms)).slice(0, 12);
  return unique.length > 0 ? `(${unique.map(escapeTextTerm).join(' | ')})` : escapeTextTerm(intent.canonical);
}

function passesFilters(game: Record<string, unknown>, filters?: Filters): boolean {
  if (filters?.categoria && toStringValue(game.categoria) !== filters.categoria) return false;
  if (filters?.provider && toStringValue(game.provider) !== filters.provider) return false;
  return true;
}

async function resolveIntent(redis: Redis, normalizedQuery: string, timing: Timing): Promise<SearchIntent | null> {
  if (!normalizedQuery) return null;
  const start = Date.now();
  const key = `intent:${await sha256Hex(normalizedQuery)}`;
  const intent = await redis.hgetall(key) as SearchIntent;
  timing.intentLookupMs = Date.now() - start;
  return intent && intent.id_jogo ? intent : null;
}

async function loadGame(redis: Redis, idJogo: string): Promise<Record<string, unknown> | null> {
  const game = await redis.hgetall(`jogo:${idJogo}`);
  if (!game || !game.id_jogo) return null;
  return { ...game, key: `jogo:${idJogo}` };
}

async function boostIntentResult(
  redis: Redis,
  games: Record<string, unknown>[],
  intent: SearchIntent | null,
  filters?: Filters,
): Promise<Record<string, unknown>[]> {
  if (!intent) return games;

  const targetId = intent.id_jogo;
  const existingIndex = games.findIndex(game => toStringValue(game.id_jogo) === targetId || toStringValue(game.key) === `jogo:${targetId}`);

  let target: Record<string, unknown> | null = existingIndex >= 0 ? games[existingIndex] : await loadGame(redis, targetId);
  if (!target || !passesFilters(target, filters)) return games;

  target = {
    ...target,
    score: 1,
    _debug: {
      ...(target._debug as Record<string, unknown> || {}),
      intentBoost: intent.id,
      matchedTerm: intent.term,
    },
  };

  const rest = existingIndex >= 0
    ? games.filter((_game, index) => index !== existingIndex)
    : games.filter(game => toStringValue(game.id_jogo) !== targetId);

  return [target, ...rest];
}

async function spellcheck(redis: Redis, query: string, timing: Timing): Promise<string> {
  const start = Date.now();
  try {
    const correctedTerms = new Set<string>();
    let corrected = query;

    const run = async (termsQuery: string, distance: '1' | '2') => {
      try {
        return await (redis as any).call(
          'FT.SPELLCHECK',
          INDEX_NAME,
          termsQuery,
          'DISTANCE',
          distance,
          'TERMS',
          'EXCLUDE',
          PROTECTED_SPELL_DICT,
        ) as unknown[];
      } catch (_e) {
        return await (redis as any).call('FT.SPELLCHECK', INDEX_NAME, termsQuery, 'DISTANCE', distance) as unknown[];
      }
    };

    const applyCorrections = (result: unknown[]) => {
      for (const item of result) {
        if (!Array.isArray(item) || item.length < 3) continue;
        const original = toStringValue(item[1]);
        const normalizedOriginal = normalizeQuery(original);
        const suggestions = item[2] as unknown[][];
        if (!suggestions || suggestions.length === 0) continue;
        if (STOPWORDS.has(normalizedOriginal) || PROTECTED_TERMS.has(normalizedOriginal)) continue;

        const ranked = suggestions
          .map(s => ({ term: toStringValue(s[1]), score: parseFloat(toStringValue(s[0])) || 0 }))
          .filter(s => s.term && s.term !== original)
          .sort((a, b) => {
            const len = Math.abs(a.term.length - original.length) - Math.abs(b.term.length - original.length);
            return len !== 0 ? len : b.score - a.score;
          });

        if (ranked.length > 0) {
          corrected = corrected.replace(original, ranked[0].term);
          correctedTerms.add(original);
        }
      }
    };

    applyCorrections(await run(query, '1'));

    const remaining = query
      .split(/\s+/)
      .filter(term => {
        const normalized = normalizeQuery(term);
        return term.length >= 3 && !correctedTerms.has(term) && !STOPWORDS.has(normalized) && !PROTECTED_TERMS.has(normalized);
      });

    if (remaining.length > 0) applyCorrections(await run(remaining.join(' '), '2'));

    timing.spellcheckMs = Date.now() - start;
    return corrected;
  } catch (e) {
    console.warn('Spellcheck failed:', e);
    timing.spellcheckMs = Date.now() - start;
    return query;
  }
}

async function getEmbeddingBuffer(redis: Redis, query: string, env: Env, timing: Timing): Promise<{ buffer: Buffer; cacheHit: boolean; key: string }> {
  const normalized = normalizeQuery(query);
  const key = await keyFor('cache:embedding', normalized);

  const lookupStart = Date.now();
  const cached = await (redis as any).getBuffer(key) as Buffer | null;
  timing.embeddingCacheLookupMs = Date.now() - lookupStart;
  if (cached && cached.length > 0) {
    return { buffer: cached, cacheHit: true, key };
  }

  const openAiStart = Date.now();
  const openai = new OpenAI({ apiKey: env.OPENAI_API_KEY });
  const embResp = await openai.embeddings.create({ model: 'text-embedding-3-small', input: query });
  timing.openAiEmbeddingMs = Date.now() - openAiStart;

  const embedding = embResp.data[0].embedding;
  const buffer = Buffer.allocUnsafe(embedding.length * 4);
  embedding.forEach((value, index) => buffer.writeFloatLE(value, index * 4));

  const writeStart = Date.now();
  await redis.set(key, buffer, 'EX', SEARCH_CONFIG.embeddingCacheTtlSeconds);
  timing.embeddingCacheWriteMs = Date.now() - writeStart;

  return { buffer, cacheHit: false, key };
}

function rankAndClean(games: Record<string, unknown>[]): Record<string, unknown>[] {
  const maxHybrid = games.length > 0
    ? Math.max(...games.map(game => parseFloat(toStringValue(game.hybrid_score || game.__score || '0'))))
    : 1;

  return games
    .map(game => {
      const hybridScore = parseFloat(toStringValue(game.hybrid_score || game.__score || '0'));
      const textScore = parseFloat(toStringValue(game.text_score || '0'));
      const vectorScore = parseFloat(toStringValue(game.vector_score || '0'));
      const popularity = Math.min(parseInt(toStringValue(game.popularity || '0'), 10), 100) / 100;
      const normalized = maxHybrid > 0 ? hybridScore / maxHybrid : 0;
      const finalScore = Math.min(normalized * (1 - SEARCH_CONFIG.popularityWeight) + popularity * SEARCH_CONFIG.popularityWeight, 1);

      const cleaned: Record<string, unknown> = {
        ...game,
        score: finalScore,
        _debug: { textScore, vectorScore, hybridScore, popularity, normalized, finalScore },
      };

      delete cleaned.__key;
      delete cleaned.__score;
      delete cleaned.text_score;
      delete cleaned.vector_score;
      delete cleaned.hybrid_score;
      return cleaned;
    })
    .filter(game => Number(game.score || 0) >= SEARCH_CONFIG.minScore)
    .sort((a, b) => Number(b.score || 0) - Number(a.score || 0))
    .slice(0, SEARCH_CONFIG.limit);
}

async function runHybridSearch(
  redis: Redis,
  query: string,
  correctedQuery: string,
  intent: SearchIntent | null,
  embedding: Buffer,
  filters: Filters | undefined,
  timing: Timing,
): Promise<{ games: Record<string, unknown>[]; queryPlan: Record<string, unknown> }> {
  const filterExpression = buildFilterExpression(filters);
  const searchExpression = intent ? intentSearchExpression(intent) : (correctedQuery || query || '*');
  const filteredSearchExpression = filterExpression ? `${filterExpression} ${searchExpression}` : searchExpression;

  const args: unknown[] = [
    'FT.HYBRID', INDEX_NAME,
    'SEARCH', filteredSearchExpression,
    'VSIM', '@description_vector', '$vec',
    'KNN', '2', 'K', String(SEARCH_CONFIG.vectorK),
  ];

  if (filterExpression) args.push('FILTER', filterExpression);

  args.push(
    'COMBINE', 'RRF', '4', 'WINDOW', String(SEARCH_CONFIG.rrfWindow), 'CONSTANT', String(SEARCH_CONFIG.rrfConstant),
    'LOAD', String(LOAD_FIELDS.length), ...LOAD_FIELDS,
  );

  args.push(
    'LIMIT', '0', String(SEARCH_CONFIG.limit),
    'PARAMS', '2', 'vec', embedding,
    'TIMEOUT', String(SEARCH_CONFIG.timeoutMs),
  );

  const hybridStart = Date.now();
  const result = await (redis as any).call(...args) as unknown[];
  timing.redisHybridMs = Date.now() - hybridStart;

  let games = rankAndClean(parseHybridResults(result));
  games = await boostIntentResult(redis, games, intent, filters);

  return {
    games,
    queryPlan: {
      index: INDEX_NAME,
      fusion: 'FT.HYBRID RRF',
      vectorK: SEARCH_CONFIG.vectorK,
      efRuntime: SEARCH_CONFIG.efRuntime,
      filterExpression: filterExpression || undefined,
      searchExpression: filteredSearchExpression,
    },
  };
}

async function handleSearch(body: unknown, env: Env): Promise<Response> {
  const payload = (body || {}) as { query?: string; filters?: Filters; debug?: boolean };
  const query = String(payload.query || '').trim();
  const filters = payload.filters || {};
  if (!query) return json({ error: 'Query is required' }, 400, env);

  const startTime = Date.now();
  const timing: Timing = {};
  const normalizedQuery = normalizeQuery(query);
  const redis = getRedis(env);
  await ensureRedis(redis, timing);

  try {
    const intent = await resolveIntent(redis, normalizedQuery, timing);
    const searchCacheKey = await keyFor('cache:search', { q: normalizedQuery, filters, intent: intent?.id || null });

    const cacheStart = Date.now();
    const cached = await redis.get(searchCacheKey);
    timing.resultCacheLookupMs = Date.now() - cacheStart;
    if (cached) {
      const response = JSON.parse(cached);
      const originTiming = response.timing || {};
      response.cache = {
        ...(response.cache || {}),
        result: 'hit',
        embedding: 'skipped',
        key: searchCacheKey.slice(-12),
      };
      response.timing = {
        redisConnectMs: timing.redisConnectMs || 0,
        intentLookupMs: timing.intentLookupMs || 0,
        resultCacheLookupMs: timing.resultCacheLookupMs,
        spellcheckMs: 0,
        embeddingCacheLookupMs: 0,
        openAiEmbeddingMs: 0,
        redisHybridMs: 0,
        cachedOriginTotalMs: originTiming.totalMs || 0,
        cachedOriginRedisHybridMs: originTiming.redisHybridMs || 0,
        totalMs: Date.now() - startTime,
      };
      response.queryPlan = {
        ...(response.queryPlan || {}),
        cache: 'Redis result cache',
      };
      response.executionTime = Date.now() - startTime;
      return json(response, 200, env);
    }

    const correctedQuery = await spellcheck(redis, query, timing);
    const embedding = await getEmbeddingBuffer(redis, intent?.rewrite || correctedQuery || query, env, timing);
    const { games, queryPlan } = await runHybridSearch(redis, query, correctedQuery, intent, embedding.buffer, filters, timing);

    const methods = ['hybrid'];
    if (intent) methods.unshift('intent');
    if (correctedQuery !== query) methods.unshift('spellcheck');
    if (embedding.cacheHit) methods.push('embedding_cache');

    const response = {
      query,
      normalizedQuery,
      correctedQuery: correctedQuery !== query ? correctedQuery : undefined,
      filters,
      total: games.length,
      results: games,
      games,
      searchMethods: methods,
      executionTime: Date.now() - startTime,
      cache: {
        result: 'miss',
        embedding: embedding.cacheHit ? 'hit' : 'miss',
        key: searchCacheKey.slice(-12),
      },
      intent: intent ? {
        id: intent.id,
        canonical: intent.canonical,
        matchedTerm: intent.term,
        id_jogo: intent.id_jogo,
      } : undefined,
      queryPlan,
      timing: {
        ...timing,
        totalMs: Date.now() - startTime,
      },
    };

    const cacheTtl = isShortTail(normalizedQuery, intent)
      ? SEARCH_CONFIG.searchCacheShortTtlSeconds
      : SEARCH_CONFIG.searchCacheDefaultTtlSeconds;
    const writeStart = Date.now();
    await redis.set(searchCacheKey, JSON.stringify(response), 'EX', cacheTtl);
    (response.timing as Timing).resultCacheWriteMs = Date.now() - writeStart;

    return json(response, 200, env);
  } finally {
    releaseRedis(redis);
  }
}

async function handleAutocomplete(query: string, env: Env): Promise<Response> {
  if (!query || query.length < 2) return json({ suggestions: [], timing: { totalMs: 0 } }, 200, env);

  const start = Date.now();
  const timing: Timing = {};
  const redis = getRedis(env);
  await ensureRedis(redis, timing);
  try {
    const redisStart = Date.now();
    const results = await (redis as any).call(
      'FT.SUGGET',
      AUTOCOMPLETE_KEY,
      query,
      'FUZZY',
      'MAX',
      '10',
      'WITHSCORES',
      'WITHPAYLOADS',
    ) as unknown[];

    return json({
      query,
      suggestions: parseAutocompleteResults(results),
      timing: { ...timing, redisMs: Date.now() - redisStart, totalMs: Date.now() - start },
      engine: 'FT.SUGGET',
    }, 200, env);
  } finally {
    releaseRedis(redis);
  }
}

async function handleCategories(env: Env): Promise<Response> {
  const start = Date.now();
  const timing: Timing = {};
  const redis = getRedis(env);
  await ensureRedis(redis, timing);
  try {
    const results = await (redis as any).call(
      'FT.AGGREGATE', INDEX_NAME,
      '*',
      'GROUPBY', '1', '@categoria',
      'REDUCE', 'COUNT', '0', 'AS', 'count',
      'SORTBY', '2', '@count', 'DESC',
    ) as unknown[];

    const categories = [];
    for (let i = 1; i < results.length; i++) {
      const row = results[i] as unknown[];
      const cat: Record<string, unknown> = {};
      for (let j = 0; j < row.length; j += 2) cat[toStringValue(row[j])] = row[j + 1];
      if (cat.categoria) categories.push({ name: toStringValue(cat.categoria), count: parseInt(toStringValue(cat.count || '0'), 10) });
    }

    return json({ categories, timing: { ...timing, redisMs: Date.now() - start } }, 200, env);
  } finally {
    releaseRedis(redis);
  }
}

async function handleVectorSearch(body: unknown, env: Env): Promise<Response> {
  const payload = (body || {}) as { query?: string; filters?: Filters };
  const query = String(payload.query || '').trim();
  if (!query) return json({ error: 'Query is required' }, 400, env);

  const start = Date.now();
  const timing: Timing = {};
  const redis = getRedis(env);
  await ensureRedis(redis, timing);
  try {
    const embedding = await getEmbeddingBuffer(redis, query, env, timing);
    const filterExpression = buildFilterExpression(payload.filters);
    const args: unknown[] = [
      'FT.HYBRID', INDEX_NAME,
      'SEARCH', filterExpression || '*',
      'VSIM', '@description_vector', '$vec',
      'KNN', '2', 'K', String(SEARCH_CONFIG.vectorK),
    ];

    if (filterExpression) args.push('FILTER', filterExpression);

    args.push(
      'COMBINE', 'LINEAR', '4', 'ALPHA', '0', 'BETA', '1',
      'LOAD', String(LOAD_FIELDS.length), ...LOAD_FIELDS,
      'LIMIT', '0', String(SEARCH_CONFIG.limit),
      'PARAMS', '2', 'vec', embedding.buffer,
      'TIMEOUT', String(SEARCH_CONFIG.timeoutMs),
    );

    const redisStart = Date.now();
    const result = await (redis as any).call(...args) as unknown[];
    timing.redisVectorMs = Date.now() - redisStart;
    const games = rankAndClean(parseHybridResults(result));

    return json({
      query,
      total: games.length,
      games,
      method: 'vector_search',
      model: 'text-embedding-3-small',
      cache: { embedding: embedding.cacheHit ? 'hit' : 'miss' },
      timing: { ...timing, totalMs: Date.now() - start },
    }, 200, env);
  } finally {
    releaseRedis(redis);
  }
}

async function handleMetrics(env: Env): Promise<Response> {
  const start = Date.now();
  const now = Date.now();
  if (metricsCache && metricsCache.expiresAt > now) {
    return json({
      ...metricsCache.payload,
      cache: { result: 'isolate_hit', ttlMs: metricsCache.expiresAt - now },
      timing: { redisMs: 0, totalMs: Date.now() - start },
    }, 200, env);
  }

  const redis = getRedis(env);
  const timing: Timing = {};
  await ensureRedis(redis, timing);
  try {
    const [serverInfo, memoryInfo, statsInfo, clientsInfo, ftInfoRaw] = await Promise.all([
      redis.info('server'),
      redis.info('memory'),
      redis.info('stats'),
      redis.info('clients'),
      (redis as any).call('FT.INFO', INDEX_NAME) as Promise<unknown[]>,
    ]);

    const server = parseInfo(serverInfo);
    const memory = parseInfo(memoryInfo);
    const stats = parseInfo(statsInfo);
    const clients = parseInfo(clientsInfo);
    const ftInfo = redisArrayToObject(ftInfoRaw);

    const keyspaceHits = parseInt(stats.keyspace_hits || '0', 10);
    const keyspaceMisses = parseInt(stats.keyspace_misses || '0', 10);
    const hitRatio = keyspaceHits + keyspaceMisses > 0
      ? keyspaceHits / (keyspaceHits + keyspaceMisses)
      : 0;

    const payload = {
      redis: {
        version: server.redis_version,
        usedMemory: memory.used_memory_human,
        connectedClients: parseInt(clients.connected_clients || '0', 10),
        opsPerSec: parseInt(stats.instantaneous_ops_per_sec || '0', 10),
        keyspaceHitRatio: Number(hitRatio.toFixed(4)),
      },
      index: {
        name: INDEX_NAME,
        docs: parseInt(toStringValue(ftInfo.num_docs || '0'), 10),
        terms: parseInt(toStringValue(ftInfo.num_terms || '0'), 10),
        invertedMb: Number(parseFloat(toStringValue(ftInfo.inverted_sz_mb || '0')).toFixed(3)),
        vectorMb: Number(parseFloat(toStringValue(ftInfo.vector_index_sz_mb || '0')).toFixed(3)),
        uses: parseInt(toStringValue(ftInfo.number_of_uses || '0'), 10),
      },
      timing: { ...timing, redisMs: Date.now() - start },
    };

    metricsCache = { expiresAt: Date.now() + METRICS_CACHE_MS, payload };
    return json(payload, 200, env);
  } finally {
    releaseRedis(redis);
  }
}

export default {
  async fetch(request: Request, env: Env, _ctx: ExecutionContext): Promise<Response> {
    const url = new URL(request.url);

    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(env) });
    }

    try {
      if (url.pathname === '/health') {
        return json({ status: 'ok', worker: 'cactus-worker', architecture: 'edge-direct', timestamp: new Date().toISOString() }, 200, env);
      }

      if (url.pathname === '/api/autocomplete' && request.method === 'GET') {
        return handleAutocomplete(url.searchParams.get('q') || '', env);
      }

      if (url.pathname === '/api/categories' && request.method === 'GET') {
        return handleCategories(env);
      }

      if (url.pathname === '/api/metrics' && request.method === 'GET') {
        return handleMetrics(env);
      }

      if (url.pathname === '/api/search' && request.method === 'POST') {
        return handleSearch(await request.json(), env);
      }

      if (url.pathname === '/api/vector-search' && request.method === 'POST') {
        return handleVectorSearch(await request.json(), env);
      }

      return json({ error: 'Not Found', path: url.pathname }, 404, env);
    } catch (error: any) {
      console.error('Worker error:', error?.message, error?.stack);
      return json({
        error: 'Internal Error',
        message: error?.message || String(error),
        stack: env.ENVIRONMENT === 'production' ? undefined : error?.stack?.split('\n').slice(0, 5),
      }, 500, env);
    }
  },
};
