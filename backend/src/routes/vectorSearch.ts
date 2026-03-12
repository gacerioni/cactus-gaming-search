import { Request, Response } from 'express';
import { getRedisClient } from '../redis';
import { parseSearchResults } from '../utils/parser';
import OpenAI from 'openai';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/**
 * POST /api/vector-search
 * Body: { query: "jogos de tigre asiático com multiplicadores" }
 * 
 * Vector search usando FT.SEARCH com KNN
 * Usa OpenAI para gerar embedding do query
 */
export async function handleVectorSearch(req: Request, res: Response) {
  try {
    const { query, k } = req.body;

    if (!query) {
      return res.status(400).json({
        error: 'Query is required',
      });
    }

    const numResults = k || 10;

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

    const redis = getRedisClient();

    // 3. Vector search: FT.SEARCH idx:games "*=>[KNN k @embedding $vec]" PARAMS 2 vec <blob> DIALECT 2
    const results = await redis.call(
      'FT.SEARCH',
      'idx:games',
      `*=>[KNN ${numResults} @embedding $vec AS score]`,
      'PARAMS',
      '2',
      'vec',
      buffer,
      'RETURN',
      '5',
      'nome',
      'provider',
      'categoria',
      'descricao',
      'score',
      'SORTBY',
      'score',
      'DIALECT',
      '2'
    ) as any[];

    const games = parseSearchResults(results);

    res.json({
      query,
      total: results[0] || 0,
      games,
      method: 'vector_search',
      model: 'text-embedding-3-small',
    });
  } catch (error: any) {
    console.error('Vector search error:', error);
    res.status(500).json({
      error: 'Vector search failed',
      message: error.message,
    });
  }
}

