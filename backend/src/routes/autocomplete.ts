import { Request, Response } from 'express';
import { getRedisClient } from '../redis';
import { parseAutocompleteResults } from '../utils/parser';

/**
 * GET /api/autocomplete?q=tig
 * 
 * Autocomplete usando FT.SUGGET
 * Porta da lógica Python: app.py linhas 75-113
 */
export async function handleAutocomplete(req: Request, res: Response): Promise<void> {
  try {
    const query = req.query.q as string;
    const maxResults = parseInt(req.query.max as string) || 10;

    if (!query || query.length < 2) {
      res.json({ suggestions: [] });
      return;
    }

    const redis = getRedisClient();

    // FT.SUGGET ac:games <query> WITHPAYLOADS WITHSCORES FUZZY MAX <maxResults>
    const results = await redis.call(
      'FT.SUGGET',
      'ac:games',
      query,
      'WITHPAYLOADS',
      'WITHSCORES',
      'FUZZY',
      'MAX',
      maxResults
    ) as any[];

    // Parse results: [text, score, payload, text, score, payload, ...]
    const suggestions = parseAutocompleteResults(results);

    res.json({
      query,
      suggestions,
      total: suggestions.length,
    });
  } catch (error: any) {
    console.error('Autocomplete error:', error);
    res.status(500).json({
      error: 'Autocomplete failed',
      message: error.message,
    });
  }
}

