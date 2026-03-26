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
export async function handleVectorSearch(req: Request, res: Response): Promise<void> {
  try {
    const { query, k } = req.body;

    if (!query) {
      res.status(400).json({
        error: 'Query is required',
      });
      return;
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

    // 3. Vector search: FT.SEARCH idx:jogos "*=>[KNN k @description_vector $vec]" PARAMS 2 vec <blob> DIALECT 2
    const results = await redis.call(
      'FT.SEARCH',
      'idx:jogos',  // Mudou de idx:games para idx:jogos
      `*=>[KNN ${numResults} @description_vector $vec AS score]`,  // Mudou de @embedding para @description_vector
      'PARAMS',
      '2',
      'vec',
      buffer,
      'RETURN',
      '8',
      'nome',
      'provider',
      'aliases',
      'categoria',
      'image',
      'rtp',
      'slug',
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

