/**
 * Parse FT.SEARCH results from Redis
 * Format: [count, key1, [field1, value1, field2, value2, ...], key2, [...], ...]
 */
export function parseSearchResults(results: any[]): any[] {
  if (!results || results.length === 0 || results[0] === 0) {
    return [];
  }

  const games: any[] = [];
  let i = 1; // Skip count at index 0

  while (i < results.length) {
    const key = results[i];
    i++;

    if (i < results.length) {
      const fields = results[i];
      i++;

      // Convert field array to object
      const game: any = { key };
      
      for (let j = 0; j < fields.length; j += 2) {
        if (j + 1 < fields.length) {
          const fieldName = fields[j];
          let fieldValue = fields[j + 1];
          
          // Parse JSON strings
          if (typeof fieldValue === 'string' && (fieldValue.startsWith('{') || fieldValue.startsWith('['))) {
            try {
              fieldValue = JSON.parse(fieldValue);
            } catch (e) {
              // Keep as string if not valid JSON
            }
          }
          
          game[fieldName] = fieldValue;
        }
      }

      games.push(game);
    }
  }

  return games;
}

/**
 * Parse FT.SUGGET results from Redis
 * Format: [suggestion1, score1, payload1, suggestion2, score2, payload2, ...]
 */
export function parseAutocompleteResults(results: any[]): any[] {
  if (!results || results.length === 0) {
    return [];
  }

  const suggestions: any[] = [];

  for (let i = 0; i < results.length; i += 3) {
    if (i + 2 < results.length) {
      suggestions.push({
        text: results[i],
        score: parseFloat(results[i + 1]),
        id_jogo: results[i + 2],
      });
    }
  }

  return suggestions;
}

