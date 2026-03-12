import { Request, Response } from 'express';
import { getRedisClient } from '../redis';
import { parseSearchResults } from '../utils/parser';

/**
 * POST /api/search
 * Body: { query: "tigre", filters?: { provider?, categoria? } }
 * 
 * Full-text search usando FT.SEARCH com fallback fuzzy
 * Porta da lógica Python: app.py linhas 116-156
 */
export async function handleSearch(req: Request, res: Response) {
  try {
    const { query, filters } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
      });
    }

    const redis = getRedisClient();

    // Build query string with filters
    let searchQuery = query;
    
    if (filters) {
      if (filters.provider) {
        searchQuery += ` @provider:{${filters.provider}}`;
      }
      if (filters.categoria) {
        searchQuery += ` @categoria:{${filters.categoria}}`;
      }
      if (filters.badges) {
        searchQuery += ` @badges:{${filters.badges}}`;
      }
    }

    // Primary search: FT.SEARCH idx:games <query> LIMIT 0 20
    let results = await redis.call(
      'FT.SEARCH',
      'idx:games',
      searchQuery,
      'LIMIT',
      '0',
      '20'
    ) as any[];

    let games = parseSearchResults(results);
    let usedFuzzy = false;

    // Fallback: if no results, try fuzzy search
    if (games.length === 0) {
      const fuzzyQuery = `%${query}%`;
      
      results = await redis.call(
        'FT.SEARCH',
        'idx:games',
        fuzzyQuery,
        'LIMIT',
        '0',
        '20'
      ) as any[];

      games = parseSearchResults(results);
      usedFuzzy = true;
    }

    res.json({
      query,
      filters: filters || {},
      total: results[0] || 0,
      games,
      fuzzy: usedFuzzy,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
}

