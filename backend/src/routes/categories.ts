import { Request, Response } from 'express';
import { getRedisClient } from '../redis';

/**
 * GET /api/categories
 *
 * Retorna categorias disponíveis com contagem de jogos.
 * Usa FT.AGGREGATE com GROUPBY para agregar por categoria.
 */
export async function handleCategories(_req: Request, res: Response): Promise<void> {
  try {
    const redis = getRedisClient();

    // FT.AGGREGATE idx:jogos "*" GROUPBY 1 @categoria REDUCE COUNT 0 AS count SORTBY 2 @count DESC
    const results = await redis.call(
      'FT.AGGREGATE',
      'idx:jogos',
      '*',
      'GROUPBY', '1', '@categoria',
      'REDUCE', 'COUNT', '0', 'AS', 'count',
      'SORTBY', '2', '@count', 'DESC'
    ) as any[];

    // Parse aggregate results: [count, [field, value, ...], [field, value, ...], ...]
    const categories: { name: string; count: number }[] = [];

    for (let i = 1; i < results.length; i++) {
      const row = results[i];
      if (Array.isArray(row)) {
        const obj: any = {};
        for (let j = 0; j < row.length; j += 2) {
          obj[row[j]] = row[j + 1];
        }
        if (obj.categoria) {
          categories.push({
            name: obj.categoria,
            count: parseInt(obj.count) || 0,
          });
        }
      }
    }

    res.json({
      total: categories.length,
      categories,
    });
  } catch (error: any) {
    console.error('Categories error:', error);
    res.status(500).json({
      error: 'Categories failed',
      message: error.message,
    });
  }
}

