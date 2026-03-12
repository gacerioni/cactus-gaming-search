import { Request, Response } from 'express';
import { HybridSearchService } from '../services/hybridSearch.service';
import { SEARCH_CONFIG } from '../config/search.config';

// Initialize hybrid search service
const hybridSearch = new HybridSearchService(SEARCH_CONFIG);

/**
 * POST /api/search
 * Body: { query: "tigre", filters?: { provider? } }
 *
 * HYBRID SEARCH: Combina FTS, Fuzzy e Vector Search em paralelo
 * - Executa todas as estratégias simultaneamente
 * - Combina resultados com scoring ponderado
 * - Deduplica e ranqueia por relevância
 * - Usa aliases/sinônimos para melhorar recall
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

    // Executa busca híbrida
    const result = await hybridSearch.search(query, filters);

    res.json({
      query: result.query,
      filters: filters || {},
      total: result.total,
      games: result.games,
      searchMethods: result.searchMethods,
      executionTime: result.executionTime,
    });
  } catch (error: any) {
    console.error('Search error:', error);
    res.status(500).json({
      error: 'Search failed',
      message: error.message,
    });
  }
}

