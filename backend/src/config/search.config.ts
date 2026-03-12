/**
 * Configuração de pesos e parâmetros para busca híbrida
 */

export const SEARCH_CONFIG = {
  // Pesos para scoring híbrido (0-1)
  weights: {
    fts: 0.4,           // Full-text search (exact match)
    fuzzy: 0.3,         // Fuzzy search (typo tolerance)
    vector: 0.8,        // Vector search (semantic similarity)
    aliasBoost: 0.3,    // Bonus para matches via aliases
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
  minScore: 0.1,
};

export type SearchConfig = typeof SEARCH_CONFIG;

