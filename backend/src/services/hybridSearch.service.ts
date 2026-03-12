/**
 * Serviço de busca híbrida que combina FTS, Fuzzy e Vector Search em paralelo
 */

import { getRedisClient } from '../redis';
import { parseSearchResults } from '../utils/parser';
import { aliasService } from './aliases.service';
import { ScoringService, SearchResult } from './scoring.service';
import OpenAI from 'openai';

const INDEX_NAME = 'idx:jogos';

// Initialize OpenAI client
const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

export interface HybridSearchConfig {
  weights: {
    fts: number;
    fuzzy: number;
    vector: number;
    aliasBoost: number;
  };
  limits: {
    fts: number;
    fuzzy: number;
    vector: number;
    final: number;
  };
  minScore: number;
}

export interface HybridSearchResult {
  query: string;
  total: number;
  games: any[];
  searchMethods: string[];
  executionTime: number;
}

export class HybridSearchService {
  private scoringService: ScoringService;

  constructor(private config: HybridSearchConfig) {
    this.scoringService = new ScoringService(config.weights);
  }

  /**
   * Executa busca híbrida paralela
   */
  async search(query: string, filters?: any): Promise<HybridSearchResult> {
    const startTime = Date.now();
    const redis = getRedisClient();
    const searchMethods: string[] = [];

    console.log(`🔍 Hybrid search: "${query}"`);

    // Expande query com aliases
    const expandedTerms = aliasService.expandQuery(query);
    console.log(`📝 Expanded terms:`, expandedTerms);

    // Executa buscas em paralelo
    const [ftsResults, fuzzyResults, vectorResults] = await Promise.allSettled([
      this.ftsSearch(redis, query, filters),
      this.fuzzySearch(redis, expandedTerms, filters),
      this.vectorSearch(redis, query, filters),
    ]);

    // Processa resultados
    const ftsGames = ftsResults.status === 'fulfilled' ? ftsResults.value : [];
    const fuzzyGames = fuzzyResults.status === 'fulfilled' ? fuzzyResults.value : [];
    const vectorGames = vectorResults.status === 'fulfilled' ? vectorResults.value : [];

    if (ftsGames.length > 0) searchMethods.push('fts');
    if (fuzzyGames.length > 0) searchMethods.push('fuzzy');
    if (vectorGames.length > 0) searchMethods.push('vector');

    console.log(`📊 Results: FTS=${ftsGames.length}, Fuzzy=${fuzzyGames.length}, Vector=${vectorGames.length}`);

    // Identifica matches via alias
    const aliasMatches = this.identifyAliasMatches(query, [...ftsGames, ...fuzzyGames, ...vectorGames]);

    // Combina e ranqueia resultados
    const scoredResults = this.scoringService.combineResults(
      ftsGames,
      fuzzyGames,
      vectorGames,
      aliasMatches
    );

    // Filtra por score mínimo e limita
    let finalResults = this.scoringService.filterByMinScore(scoredResults, this.config.minScore);
    finalResults = this.scoringService.limitResults(finalResults, this.config.limits.final);

    const games = this.scoringService.formatResults(finalResults);
    const executionTime = Date.now() - startTime;

    console.log(`✅ Hybrid search completed in ${executionTime}ms, ${games.length} results`);

    return {
      query,
      total: games.length,
      games,
      searchMethods,
      executionTime,
    };
  }

  /**
   * Full-text search
   */
  private async ftsSearch(redis: any, query: string, _filters?: any): Promise<SearchResult[]> {
    try {
      const results = await redis.call(
        'FT.SEARCH',
        INDEX_NAME,
        query,
        'LIMIT',
        '0',
        this.config.limits.fts.toString()
      ) as any[];

      return parseSearchResults(results);
    } catch (error) {
      console.warn('FTS search failed:', error);
      return [];
    }
  }

  /**
   * Fuzzy search com termos expandidos
   */
  private async fuzzySearch(redis: any, expandedTerms: string[], _filters?: any): Promise<SearchResult[]> {
    try {
      // Cria query fuzzy com termos expandidos usando wildcard prefix/suffix
      // RediSearch syntax: *term* para wildcard, ou term* para prefix
      const fuzzyQuery = expandedTerms
        .filter(term => term.length > 2) // Ignora termos muito curtos
        .map(term => `*${term}*`)
        .join(' | ');

      if (!fuzzyQuery) {
        return [];
      }

      const results = await redis.call(
        'FT.SEARCH',
        INDEX_NAME,
        fuzzyQuery,
        'LIMIT',
        '0',
        this.config.limits.fuzzy.toString()
      ) as any[];

      return parseSearchResults(results);
    } catch (error) {
      console.warn('Fuzzy search failed:', error);
      return [];
    }
  }

  /**
   * Vector search (KNN)
   */
  private async vectorSearch(redis: any, query: string, _filters?: any): Promise<SearchResult[]> {
    try {
      // 1. Generate embedding
      const embeddingResponse = await openai.embeddings.create({
        model: 'text-embedding-3-small',
        input: query,
      });

      const queryEmbedding = embeddingResponse.data[0].embedding;

      // 2. Convert to buffer
      const buffer = Buffer.allocUnsafe(queryEmbedding.length * 4);
      queryEmbedding.forEach((value, index) => {
        buffer.writeFloatLE(value, index * 4);
      });

      // 3. KNN search
      const results = await redis.call(
        'FT.SEARCH',
        INDEX_NAME,
        `*=>[KNN ${this.config.limits.vector} @description_vector $vec AS score]`,
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

      return parseSearchResults(results);
    } catch (error) {
      console.warn('Vector search failed:', error);
      return [];
    }
  }

  /**
   * Identifica quais resultados vieram de matches via alias
   */
  private identifyAliasMatches(query: string, allResults: SearchResult[]): Set<string> {
    const aliasMatches = new Set<string>();
    const queryTerms = query.toLowerCase().split(/\s+/);

    allResults.forEach(result => {
      const gameName = result.nome?.toLowerCase() || '';
      const gameAliases = result.aliases?.toLowerCase() || '';

      // Verifica se algum termo da query tem alias que matcha o nome/aliases do jogo
      queryTerms.forEach(term => {
        if (aliasService.hasAliases(term)) {
          const aliases = aliasService.getAliases(term);
          const hasMatch = aliases.some(alias => 
            gameName.includes(alias) || gameAliases.includes(alias)
          );
          if (hasMatch) {
            aliasMatches.add(result.id);
          }
        }
      });
    });

    return aliasMatches;
  }
}

