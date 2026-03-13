/**
 * Serviço de scoring e deduplicação de resultados de busca híbrida
 */

export interface SearchResult {
  id: string;
  nome: string;
  provider?: string;
  aliases?: string;
  score?: number;
  [key: string]: any;
}

export interface ScoredResult extends SearchResult {
  finalScore: number;
  sources: {
    fts?: number;
    fuzzy?: number;
    vector?: number;
    alias?: boolean;
  };
}

export interface SearchWeights {
  fts: number;
  fuzzy: number;
  vector: number;
  aliasBoost: number;
}

export interface SearchConfig {
  weights: SearchWeights;
  vectorMinScore?: number;
}

export class ScoringService {
  constructor(private weights: SearchWeights) {
    // Vector search agora usa ranking KNN, sem threshold
  }

  /**
   * Combina e deduplica resultados de múltiplas fontes
   */
  public combineResults(
    ftsResults: SearchResult[],
    fuzzyResults: SearchResult[],
    vectorResults: SearchResult[],
    aliasMatches: Set<string>
  ): ScoredResult[] {
    const resultMap = new Map<string, ScoredResult>();

    // Processa resultados FTS
    ftsResults.forEach((result, index) => {
      const score = this.calculatePositionScore(index, ftsResults.length);
      this.addOrUpdateResult(resultMap, result, 'fts', score, aliasMatches);
    });

    // Processa resultados Fuzzy
    fuzzyResults.forEach((result, index) => {
      const score = this.calculatePositionScore(index, fuzzyResults.length);
      this.addOrUpdateResult(resultMap, result, 'fuzzy', score, aliasMatches);
    });

    // Processa resultados Vector (já vem com score do Redis)
    // IMPORTANTE: Redis KNN retorna DISTÂNCIA (menor = melhor)
    // KNN já limita os resultados, então aceitamos todos
    vectorResults.forEach((result, index) => {
      // Normaliza distância para score 0-1 usando posição no ranking
      // Primeiro resultado = score mais alto, decai exponencialmente
      const normalizedScore = this.calculatePositionScore(index, vectorResults.length);
      this.addOrUpdateResult(resultMap, result, 'vector', normalizedScore, aliasMatches);
    });

    // Calcula score final e ordena
    const scoredResults = Array.from(resultMap.values());
    scoredResults.forEach(result => {
      result.finalScore = this.calculateFinalScore(result);
    });

    return scoredResults.sort((a, b) => b.finalScore - a.finalScore);
  }

  /**
   * Adiciona ou atualiza resultado no mapa
   */
  private addOrUpdateResult(
    resultMap: Map<string, ScoredResult>,
    result: SearchResult,
    source: 'fts' | 'fuzzy' | 'vector',
    score: number,
    aliasMatches: Set<string>
  ): void {
    // Use 'key' (from Redis) or 'id' as unique identifier
    const id = (result as any).key || result.id;
    
    if (!resultMap.has(id)) {
      // Novo resultado
      const scoredResult: ScoredResult = {
        ...result,
        finalScore: 0,
        sources: {
          [source]: score,
          alias: aliasMatches.has(id),
        },
      };
      resultMap.set(id, scoredResult);
    } else {
      // Atualiza resultado existente
      const existing = resultMap.get(id)!;
      existing.sources[source] = Math.max(existing.sources[source] || 0, score);
      if (aliasMatches.has(id)) {
        existing.sources.alias = true;
      }
    }
  }

  /**
   * Calcula score baseado na posição no ranking (1.0 para primeiro, decai exponencialmente)
   */
  private calculatePositionScore(position: number, total: number): number {
    if (total === 0) return 0;
    // Score decai exponencialmente: primeiro = 1.0, último ≈ 0.1
    return Math.exp(-3 * position / total);
  }

  /**
   * Calcula score final ponderado
   */
  private calculateFinalScore(result: ScoredResult): number {
    let score = 0;

    // Aplica pesos para cada fonte
    if (result.sources.fts !== undefined) {
      score += result.sources.fts * this.weights.fts;
    }

    if (result.sources.fuzzy !== undefined) {
      score += result.sources.fuzzy * this.weights.fuzzy;
    }

    if (result.sources.vector !== undefined) {
      score += result.sources.vector * this.weights.vector;
    }

    // Bonus para matches via alias
    if (result.sources.alias) {
      score += this.weights.aliasBoost;
    }

    return Math.min(score, 1.0); // Cap em 1.0
  }

  /**
   * Filtra resultados por score mínimo
   */
  public filterByMinScore(results: ScoredResult[], minScore: number): ScoredResult[] {
    return results.filter(r => r.finalScore >= minScore);
  }

  /**
   * Limita número de resultados
   */
  public limitResults(results: ScoredResult[], limit: number): ScoredResult[] {
    return results.slice(0, limit);
  }

  /**
   * Formata resultados para resposta da API (remove metadados internos)
   */
  public formatResults(results: ScoredResult[]): any[] {
    return results.map(({ finalScore, sources, ...rest }) => ({
      ...rest,
      score: finalScore,
      // Opcional: incluir debug info
      _debug: process.env.NODE_ENV === 'development' ? { sources } : undefined,
    }));
  }
}

