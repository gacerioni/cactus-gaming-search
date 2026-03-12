/**
 * Serviço de aliases e sinônimos para melhorar recall da busca
 * Mapeia termos coloquiais/traduzidos para termos oficiais dos jogos
 */

export class AliasService {
  private aliasMap: Map<string, string[]>;

  constructor() {
    this.aliasMap = new Map();
    this.initializeAliases();
  }

  /**
   * Inicializa mapeamento de aliases
   */
  private initializeAliases(): void {
    // Animais (PT → EN)
    this.addAlias('felino', ['tiger', 'cat', 'lion', 'panther', 'tigre', 'gato', 'leão']);
    this.addAlias('tigre', ['tiger', 'felino']);
    this.addAlias('gato', ['cat', 'felino']);
    this.addAlias('leão', ['lion', 'felino']);
    this.addAlias('dragão', ['dragon', 'dragao']);
    this.addAlias('dragao', ['dragon', 'dragão']);
    this.addAlias('lobo', ['wolf']);
    this.addAlias('urso', ['bear']);
    this.addAlias('águia', ['eagle', 'aguia']);
    this.addAlias('aguia', ['eagle', 'águia']);
    this.addAlias('cobra', ['snake', 'serpent']);
    this.addAlias('peixe', ['fish']);
    this.addAlias('tubarão', ['shark', 'tubarao']);
    this.addAlias('tubarao', ['shark', 'tubarão']);

    // Regiões/Temas
    this.addAlias('asiático', ['asian', 'asia', 'asiatico', 'oriental']);
    this.addAlias('asiatico', ['asian', 'asia', 'asiático', 'oriental']);
    this.addAlias('oriental', ['asian', 'asia', 'east']);
    this.addAlias('egípcio', ['egypt', 'egipcio', 'egyptian']);
    this.addAlias('egipcio', ['egypt', 'egípcio', 'egyptian']);
    this.addAlias('grego', ['greek', 'greece']);
    this.addAlias('romano', ['roman', 'rome']);
    this.addAlias('viking', ['norse', 'nordic']);
    this.addAlias('asteca', ['aztec']);
    this.addAlias('maia', ['mayan']);

    // Tipos de jogo
    this.addAlias('caça', ['hunt', 'hunting', 'caca']);
    this.addAlias('caca', ['hunt', 'hunting', 'caça']);
    this.addAlias('níquel', ['slot', 'niquel']);
    this.addAlias('niquel', ['slot', 'níquel']);
    this.addAlias('roleta', ['roulette']);
    this.addAlias('pôquer', ['poker', 'poquer']);
    this.addAlias('poquer', ['poker', 'pôquer']);
    this.addAlias('blackjack', ['21', 'vinte e um']);
    this.addAlias('dados', ['dice', 'craps']);

    // Temas/Conceitos
    this.addAlias('fortuna', ['fortune', 'lucky', 'sorte']);
    this.addAlias('sorte', ['fortune', 'lucky', 'fortuna']);
    this.addAlias('riqueza', ['wealth', 'riches', 'treasure', 'tesouro']);
    this.addAlias('tesouro', ['treasure', 'riches', 'riqueza']);
    this.addAlias('ouro', ['gold', 'golden']);
    this.addAlias('prata', ['silver']);
    this.addAlias('diamante', ['diamond']);
    this.addAlias('joia', ['jewel', 'gem', 'jóia']);
    this.addAlias('jóia', ['jewel', 'gem', 'joia']);
    this.addAlias('rei', ['king']);
    this.addAlias('rainha', ['queen']);
    this.addAlias('príncipe', ['prince', 'principe']);
    this.addAlias('principe', ['prince', 'príncipe']);
    this.addAlias('princesa', ['princess']);
    this.addAlias('deus', ['god']);
    this.addAlias('deusa', ['goddess']);

    // Números/Multiplicadores
    this.addAlias('mega', ['mega', 'big', 'grande']);
    this.addAlias('super', ['super', 'ultra']);
    this.addAlias('hiper', ['hyper', 'ultra']);
  }

  /**
   * Adiciona um alias ao mapa
   */
  private addAlias(term: string, aliases: string[]): void {
    const normalized = term.toLowerCase().trim();
    this.aliasMap.set(normalized, aliases.map(a => a.toLowerCase()));
  }

  /**
   * Expande uma query com aliases
   * Ex: "felino asiático" → ["felino", "tiger", "cat", "asiático", "asian", "oriental"]
   */
  public expandQuery(query: string): string[] {
    const terms = query.toLowerCase().split(/\s+/);
    const expanded = new Set<string>();

    // Adiciona termos originais
    terms.forEach(term => expanded.add(term));

    // Adiciona aliases
    terms.forEach(term => {
      const aliases = this.aliasMap.get(term);
      if (aliases) {
        aliases.forEach(alias => expanded.add(alias));
      }
    });

    return Array.from(expanded);
  }

  /**
   * Gera queries alternativas com aliases
   * Ex: "jogo do felino asiático" → ["jogo do tiger asian", "jogo do cat oriental", ...]
   */
  public generateAliasQueries(query: string): string[] {
    // Retorna combinações de termos expandidos
    // Para simplificar, retorna a query original + versão com todos os aliases
    const queries = new Set<string>();
    queries.add(query.toLowerCase());

    // Adiciona query com aliases principais (primeiro de cada lista)
    const terms = query.toLowerCase().split(/\s+/);
    const aliasedTerms = terms.map(term => {
      const aliases = this.aliasMap.get(term);
      return aliases && aliases.length > 0 ? aliases[0] : term;
    });
    queries.add(aliasedTerms.join(' '));

    return Array.from(queries);
  }

  /**
   * Verifica se um termo tem aliases
   */
  public hasAliases(term: string): boolean {
    return this.aliasMap.has(term.toLowerCase());
  }

  /**
   * Retorna aliases de um termo
   */
  public getAliases(term: string): string[] {
    return this.aliasMap.get(term.toLowerCase()) || [];
  }
}

// Singleton instance
export const aliasService = new AliasService();

