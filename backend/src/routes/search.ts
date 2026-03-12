import { Request, Response } from 'express';
import { getRedisClient } from '../redis';
import { parseSearchResults } from '../utils/parser';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/search
 * Body: { query: "tigre", filters?: { provider? } }
 *
 * SEARCH-AS-A-SERVICE: Multi-layer search
 * 1. FT.SEARCH (full-text com sinônimos)
 * 2. Fuzzy fallback (%query%)
 * 3. Vector search fallback (KNN)
 *
 * Porta da lógica Python original
 */
export async function handleSearch(req: Request, res: Response): Promise<void> {
  try {
    const { query, filters } = req.body;

    if (!query) {
      res.status(400).json({
        error: 'Query is required',
      });
      return;
    }

    const redis = getRedisClient();
    const INDEX_NAME = 'idx:jogos';  // HASH schema

    // Build query string with filters
    let searchQuery = query;

    if (filters?.provider) {
      searchQuery += ` @provider:{${filters.provider}}`;
    }

    let games: any[] = [];
    let searchMethod = '';
    let totalResults = 0;

    // LAYER 1: Full-text search (com sinônimos automáticos)
    try {
      const results = await redis.call(
        'FT.SEARCH',
        INDEX_NAME,
        searchQuery,
        'LIMIT',
        '0',
        '20'
      ) as any[];

      games = parseSearchResults(results);
      totalResults = results[0] || 0;
      searchMethod = 'full-text';
    } catch (error) {
      console.error('FT.SEARCH error:', error);
    }

    // LAYER 2: Fuzzy fallback (se não achou nada)
    if (games.length === 0) {
      try {
        const fuzzyQuery = `%${query}%`;

        const results = await redis.call(
          'FT.SEARCH',
          INDEX_NAME,
          fuzzyQuery,
          'LIMIT',
          '0',
          '20'
        ) as any[];

        games = parseSearchResults(results);
        totalResults = results[0] || 0;
        searchMethod = 'fuzzy';
      } catch (error) {
        console.error('Fuzzy search error:', error);
      }
    }

    // LAYER 3: Vector search fallback (último recurso)
    if (games.length === 0) {
      try {
        console.log('🧠 Fallback para vector search...');

        // 1. Generate embedding for query using OpenAI
        const embeddingResponse = await openai.embeddings.create({
          model: 'text-embedding-3-small',
          input: query,
        });

        const queryEmbedding = embeddingResponse.data[0].embedding;

        // 2. Convert embedding to buffer (FLOAT32)
        const buffer = Buffer.allocUnsafe(queryEmbedding.length * 4);
        queryEmbedding.forEach((value, index) => {
          buffer.writeFloatLE(value, index * 4);
        });

        // 3. Vector search: FT.SEARCH idx:jogos "*=>[KNN k @description_vector $vec]" PARAMS 2 vec <blob> DIALECT 2
        const results = await redis.call(
          'FT.SEARCH',
          INDEX_NAME,
          `*=>[KNN 20 @description_vector $vec AS score]`,
          'PARAMS',
          '2',
          'vec',
          buffer,
          'RETURN',
          '4',
          'nome',
          'provider',
          'aliases',
          'score',
          'SORTBY',
          'score',
          'DIALECT',
          '2'
        ) as any[];

        games = parseSearchResults(results);
        totalResults = results[0] || 0;
        searchMethod = 'vector';

        console.log(`✅ Vector search retornou ${games.length} resultados`);
      } catch (error) {
        console.error('Vector search error:', error);
      }
    }

    res.json({
      query,
      filters: filters || {},
      total: totalResults,
      games,
      searchMethod,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
}

