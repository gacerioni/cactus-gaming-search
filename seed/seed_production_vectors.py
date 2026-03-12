"""
Seed Redis Cloud com schema de produção + Vector Search
Baseado no backoffice Cactus Gaming
"""
import os
import sys
import json
from pathlib import Path
from redis_client import get_redis_client
from embeddings import get_embedding_generator

# Carregar dados do arquivo JSON existente
GAMES_DATA_FILE = Path(__file__).parent.parent / "games_data.json"

def load_games_data():
    """Carrega dados do games_data.json"""
    try:
        with open(GAMES_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data['games'])} games from games_data.json")
        return data
    except FileNotFoundError:
        print(f"❌ ERROR: {GAMES_DATA_FILE} not found!")
        sys.exit(1)

def create_indexes_with_vectors(client):
    """Criar índices RediSearch com suporte a vector search"""
    print("🔧 Criando índices...")
    
    try:
        # Dropar índices existentes
        client.execute_command('FT.DROPINDEX', 'idx:games')
        print("  ✓ Índice antigo removido")
    except:
        pass
    
    # Índice principal COM vector search
    client.execute_command(
        'FT.CREATE', 'idx:games',
        'ON', 'JSON',
        'PREFIX', '1', 'game:',
        'SCHEMA',
        '$.nome', 'AS', 'nome', 'TEXT', 'SORTABLE',
        '$.provider', 'AS', 'provider', 'TAG', 'SORTABLE',
        '$.categoria', 'AS', 'categoria', 'TAG', 'SORTABLE',
        '$.tipo_cactus', 'AS', 'tipo_cactus', 'TAG',
        '$.badges[*]', 'AS', 'badges', 'TAG',
        '$.descricao', 'AS', 'descricao', 'TEXT',
        '$.termos_busca[*]', 'AS', 'termos_busca', 'TEXT',
        '$.seo.keywords[*]', 'AS', 'keywords', 'TEXT',
        # VECTOR FIELD
        '$.embedding', 'AS', 'embedding', 'VECTOR', 'HNSW', '6',
        'TYPE', 'FLOAT32',
        'DIM', '1536',  # OpenAI text-embedding-3-small
        'DISTANCE_METRIC', 'COSINE'
    )
    print("  ✓ Índice principal criado (idx:games) com vector search")

def seed_games_with_embeddings(client, games):
    """Seed de jogos COM embeddings OpenAI"""
    print(f"\n🎮 Inserindo {len(games)} jogos...")
    
    # Inicializar gerador de embeddings
    print("🧠 Gerando embeddings com OpenAI...")
    generator = get_embedding_generator()
    
    # Preparar textos para batch embedding
    texts = []
    game_objects = []
    
    for game_data in games:
        # Converter para schema de produção
        game = convert_to_production_schema(game_data)
        
        # Texto para embedding (descrição do jogo)
        description = game_data.get('description', game_data.get('descricao', ''))
        if description:
            texts.append(description)
            game_objects.append(game)
    
    # Gerar embeddings em batch (mais eficiente)
    print(f"📡 Chamando OpenAI API para {len(texts)} descrições...")
    embeddings = generator.generate_batch(texts)
    
    # Salvar jogos com embeddings
    for game, embedding in zip(game_objects, embeddings):
        # Adicionar embedding ao objeto
        game['embedding'] = embedding
        
        # Salvar no Redis como JSON
        client.json().set(f"game:{game['id']}", '$', game)
        print(f"  ✓ {game['nome']} ({game['provider']})")

def convert_to_production_schema(game_data):
    """Converte dados do games_data.json para schema de produção"""
    # Extrair termos de busca dos aliases
    aliases = game_data.get('aliases', '')
    termos_busca = [term.strip() for term in aliases.split() if len(term.strip()) > 2]
    
    return {
        "id": game_data.get('id_jogo', game_data.get('id')),
        "nome": game_data['nome'],
        "provider": game_data['provider'],
        "tipo_cactus": "Slot",  # Default
        "tipo_provedor": "Slot",
        "categoria": "slot",
        "badges": ["FS", "CERT"],
        "descricao": game_data.get('description', game_data.get('descricao', '')),
        "termos_busca": termos_busca[:10],  # Limitar a 10 termos
        "thumbnail_principal": "https://images.unsplash.com/photo-1596838132731-3301c3fd4317",
        "thumbnails": {
            "300_250": "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=300&h=250",
            "home_banner": "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=1200&h=400",
            "mobile_hero": "https://images.unsplash.com/photo-1596838132731-3301c3fd4317?w=400&h=600"
        },
        "seo": {
            "titulo": f"{game_data['nome']} - Jogue Agora",
            "meta_description": f"Experimente {game_data['nome']}, jogo {game_data['provider']}.",
            "keywords": [game_data['nome'].lower(), game_data['provider'].lower()]
        }
    }

def seed_autocomplete(client, games):
    """Seed de autocomplete"""
    print("\n💡 Criando sugestões de autocomplete...")
    
    # Limpar autocomplete existente
    try:
        client.execute_command('DEL', 'ac:games')
    except:
        pass
    
    for game_data in games:
        game = convert_to_production_schema(game_data)
        
        # Nome oficial
        client.execute_command(
            'FT.SUGADD', 'ac:games', game['nome'], 1.0, 'PAYLOAD', game['id']
        )
        
        # Termos de busca (apelidos)
        for termo in game['termos_busca'][:5]:  # Top 5 termos
            try:
                client.execute_command(
                    'FT.SUGADD', 'ac:games', termo, 0.9, 'PAYLOAD', game['id']
                )
            except:
                pass  # Ignorar duplicatas
        
        # Provider
        try:
            client.execute_command(
                'FT.SUGADD', 'ac:games', game['provider'], 0.7, 'PAYLOAD', game['id']
            )
        except:
            pass
        
        print(f"  ✓ {game['nome']}: {len(game['termos_busca']) + 2} sugestões")

def seed_synonyms(client, synonym_groups):
    """Seed de sinônimos"""
    print("\n🔄 Criando sinônimos...")
    
    for group in synonym_groups:
        client.execute_command(
            'FT.SYNUPDATE', 'idx:games', group['id'], *group['terms']
        )
        print(f"  ✓ {group['id']}: {', '.join(group['terms'][:3])}...")

def main():
    """Executar seed completo"""
    print("=" * 60)
    print("🌵 CACTUS GAMING - SEED PRODUÇÃO COM VECTORS")
    print("=" * 60)
    
    # Carregar dados
    data = load_games_data()
    games = data['games']
    synonym_groups = data.get('synonym_groups', [])
    
    # Conectar Redis
    client = get_redis_client()
    print("✅ Connected to Redis")
    
    # Verificar módulo Search
    try:
        modules = client.execute_command("MODULE", "LIST")
        search_enabled = any("search" in str(module).lower() for module in modules)
        if search_enabled:
            print("✅ Redis Search module verified")
    except:
        print("⚠️  Could not verify Search module")
    
    # 1. Criar índices
    create_indexes_with_vectors(client)
    
    # 2. Seed de jogos COM embeddings
    seed_games_with_embeddings(client, games)
    
    # 3. Seed de autocomplete
    seed_autocomplete(client, games)
    
    # 4. Seed de sinônimos
    if synonym_groups:
        seed_synonyms(client, synonym_groups)
    
    print("\n" + "=" * 60)
    print("✅ SEED COMPLETO!")
    print("=" * 60)
    print(f"\n📊 Estatísticas:")
    print(f"  • {len(games)} jogos cadastrados")
    print(f"  • {len(games)} embeddings gerados (OpenAI 1536D)")
    print(f"  • Índice: idx:games (TEXT + TAG + VECTOR)")
    print(f"  • Autocomplete: ac:games")
    print(f"\n🧪 Testar:")
    print(f"  FT.SEARCH idx:games 'tigre' LIMIT 0 10")
    print(f"  FT.SUGGET ac:games 'tig' FUZZY MAX 10")
    print()

if __name__ == '__main__':
    main()

