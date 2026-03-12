"""
Transforma dados do formato do Backoffice Cactus para o formato Redis
Mapeia campos do BO para o schema HASH do Redis
"""
import json
from pathlib import Path

# Arquivos
BACKOFFICE_FILE = Path(__file__).parent / "games_backoffice_format.json"
OUTPUT_FILE = Path(__file__).parent.parent / "games_data.json"

def transform_game(bo_game):
    """
    Transforma um jogo do formato BO para formato Redis
    
    BO Format:
    {
      "nome": "Fortune Tiger",
      "tipo_cactus": "Slot",
      "tipo_provedor": "Slot",
      "provider": "PG Soft",
      "descricao": "Slot oriental...",
      "termos_busca": ["tigrinho", "jogo do tigre"],
      "tags": ["FS", "CERT"],
      "categoria": "slot"
    }
    
    Redis Format:
    {
      "id_jogo": "1",
      "nome": "Fortune Tiger",
      "provider": "PG Soft",
      "aliases": "tigrinho jogo do tigre fortun tigre",
      "popularity": 100,
      "description": "Slot oriental...",
      "categoria": "slot",
      "tags": "FS CERT"
    }
    """
    
    # Combina termos_busca em string flat
    termos = bo_game.get('termos_busca', [])
    aliases = ' '.join(termos) if termos else ''
    
    # Combina tags em string flat
    tags_list = bo_game.get('tags', [])
    tags = ' '.join(tags_list) if tags_list else ''
    
    # Monta objeto transformado
    redis_game = {
        'id_jogo': bo_game['id_jogo'],
        'nome': bo_game['nome'],
        'provider': bo_game['provider'],
        'aliases': aliases,
        'popularity': bo_game.get('popularity', 50),
        'description': bo_game.get('descricao', ''),
        'categoria': bo_game.get('categoria', bo_game.get('tipo_cactus', 'slot').lower()),
        'tags': tags
    }
    
    return redis_game

def transform_all():
    """Transforma todos os jogos do BO para formato Redis"""
    
    # Carrega dados do BO
    with open(BACKOFFICE_FILE, 'r', encoding='utf-8') as f:
        bo_data = json.load(f)
    
    print(f"📥 Loaded {len(bo_data['games'])} games from backoffice format")
    
    # Transforma cada jogo
    redis_games = []
    for bo_game in bo_data['games']:
        redis_game = transform_game(bo_game)
        redis_games.append(redis_game)
        print(f"  ✓ {redis_game['nome']} → aliases: {redis_game['aliases'][:50]}...")
    
    # Monta estrutura final
    output_data = {
        'games': redis_games,
        'synonym_groups': bo_data.get('synonym_groups', [])
    }
    
    # Salva no formato Redis
    with open(OUTPUT_FILE, 'w', encoding='utf-8') as f:
        json.dump(output_data, f, ensure_ascii=False, indent=2)
    
    print(f"\n✅ Saved {len(redis_games)} games to {OUTPUT_FILE}")
    print(f"\n📊 Sample output:")
    print(json.dumps(redis_games[0], ensure_ascii=False, indent=2))

if __name__ == '__main__':
    transform_all()

