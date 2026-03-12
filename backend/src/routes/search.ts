import { Request, Response } from 'express';
import { getRedisClient } from '../redis';
import { parseSearchResults } from '../utils/parser';

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
    // TODO: Implementar KNN search se ainda não achou nada
    // if (games.length === 0) {
    //   searchMethod = 'vector';
    // }

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

