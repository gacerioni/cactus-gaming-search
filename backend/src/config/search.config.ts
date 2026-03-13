/**
 * Configuração de pesos e parâmetros para busca híbrida
 */

export const SEARCH_CONFIG = {
  // Pesos para scoring híbrido (0-1)
  weights: {
    fts: 1.0,           // Full-text search (exact match) - PESO MÁXIMO
    fuzzy: 0.6,         // Fuzzy search (typo tolerance)
    vector: 0.5,        // Vector search (semantic similarity) - REDUZIDO
    aliasBoost: 0.4,    // Bonus para matches via aliases
  },

  // Parâmetros de busca
  limits: {
    fts: 20,            // Max resultados FTS
    fuzzy: 20,          // Max resultados Fuzzy
    vector: 20,         // Max resultados VSS (KNN k)
    final: 20,          // Max resultados finais após deduplicação
  },

  // Configuração de embedding
  embedding: {
    model: 'text-embedding-3-small',
    dimensions: 1536,
  },

  // Redis index
  indexName: 'idx:jogos',

  // Threshold mínimo de score para incluir resultado
  minScore: 0.05,      // Muito permissivo para retornar mais resultados

  // Threshold específico para vector search (distância máxima aceitável)
  vectorMinScore: 1.5,  // Aceita resultados com distância até 1.5 (mais permissivo)
};

export type SearchConfig = typeof SEARCH_CONFIG;

