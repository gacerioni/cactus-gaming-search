"""
Seed Redis Cloud com schema de produção + Vector Search
Baseado no backoffice Cactus Gaming

SCHEMA: HASH (flat) - igual ao Python original
Permite aliases, sinônimos e busca multi-camada
"""
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
    """Criar índices RediSearch com suporte a vector search - HASH SCHEMA"""
    print("🔧 Criando índices...")

    try:
        # Dropar índices existentes
        client.execute_command('FT.DROPINDEX', 'idx:jogos')
        print("  ✓ Índice antigo removido")
    except:
        pass

    # Índice principal COM vector search - USANDO HASH (igual Python original)
    client.execute_command(
        'FT.CREATE', 'idx:jogos',
        'ON', 'HASH',
        'PREFIX', '1', 'jogo:',
        'SCHEMA',
        'nome', 'TEXT', 'WEIGHT', '5', 'SORTABLE',
        'aliases', 'TEXT', 'WEIGHT', '2',  # ← CAMPO CRÍTICO para mengao, bambi, etc
        'provider', 'TAG', 'SORTABLE',
        'id_jogo', 'TAG',
        'popularity', 'NUMERIC', 'SORTABLE',
        # VECTOR FIELD
        'description_vector', 'VECTOR', 'FLAT', '6',
        'TYPE', 'FLOAT32',
        'DIM', '1536',  # OpenAI text-embedding-3-small
        'DISTANCE_METRIC', 'COSINE'
    )
    print("  ✓ Índice principal criado (idx:jogos) com HASH + vector search")

def seed_games_with_embeddings(client, games):
    """Seed de jogos COM embeddings OpenAI - HASH SCHEMA"""
    print(f"\n🎮 Inserindo {len(games)} jogos...")

    # Inicializar gerador de embeddings
    print("🧠 Gerando embeddings com OpenAI...")
    generator = get_embedding_generator()

    # Preparar textos para batch embedding
    texts = []
    game_ids = []

    for game_data in games:
        description = game_data.get('description', '')
        if description:
            texts.append(description)
            game_ids.append(game_data['id_jogo'])

    # Gerar embeddings em batch (mais eficiente)
    print(f"📡 Chamando OpenAI API para {len(texts)} descrições...")
    embeddings = generator.generate_batch(texts)

    # Criar dicionário de embeddings
    embedding_map = dict(zip(game_ids, embeddings))

    # Salvar jogos como HASH
    import struct
    for game_data in games:
        key = f"jogo:{game_data['id_jogo']}"

        # Preparar dados flat para HASH
        hash_data = {
            'id_jogo': game_data['id_jogo'],
            'nome': game_data['nome'],
            'provider': game_data['provider'],
            'aliases': game_data['aliases'],  # ← CRÍTICO! String com todos os termos
            'popularity': str(game_data.get('popularity', 50))
        }

        # Adicionar embedding se existir
        if game_data['id_jogo'] in embedding_map:
            embedding = embedding_map[game_data['id_jogo']]
            # Converter para bytes (FLOAT32)
            embedding_bytes = struct.pack(f'{len(embedding)}f', *embedding)
            hash_data['description_vector'] = embedding_bytes

        # Salvar no Redis como HASH
        client.hset(key, mapping=hash_data)
        print(f"  ✓ {game_data['nome']} ({game_data['provider']})")

def seed_autocomplete(client, games):
    """Seed de autocomplete usando FT.SUGADD"""
    print("\n🔍 Populando autocomplete...")

    suggestion_key = "ac:jogos"

    # Limpar sugestões antigas
    try:
        client.delete(suggestion_key)
    except:
        pass

    suggestion_count = 0

    for game in games:
        # Adicionar nome principal
        client.execute_command(
            'FT.SUGADD', suggestion_key,
            game['nome'],
            game.get('popularity', 50),
            'PAYLOAD', game['id_jogo']
        )
        suggestion_count += 1

        # Adicionar aliases individuais
        aliases = game.get('aliases', '').split()
        for alias in aliases[:10]:  # Limitar a 10 aliases por jogo
            if len(alias) > 2:
                try:
                    client.execute_command(
                        'FT.SUGADD', suggestion_key,
                        alias,
                        game.get('popularity', 50) * 0.8,  # Score menor para aliases
                        'PAYLOAD', game['id_jogo']
                    )
                    suggestion_count += 1
                except:
                    pass  # Ignorar duplicatas

    print(f"  ✓ {suggestion_count} sugestões adicionadas")

def seed_synonyms(client, synonym_groups):
    """Seed de sinônimos - CRÍTICO para mengao, bambi, etc"""
    print("\n🔄 Criando sinônimos...")

    for group in synonym_groups:
        client.execute_command(
            'FT.SYNUPDATE', 'idx:jogos', group['id'], *group['terms']  # idx:jogos (HASH)
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
    print(f"  • {len(games)} jogos cadastrados (HASH schema)")
    print(f"  • {len(games)} embeddings gerados (OpenAI 1536D)")
    print(f"  • {len(synonym_groups)} grupos de sinônimos")
    print(f"  • Índice: idx:jogos (HASH + VECTOR)")
    print(f"  • Autocomplete: ac:jogos")
    print(f"\n🧪 Testar:")
    print(f"  FT.SEARCH idx:jogos 'mengao' LIMIT 0 10  # Deve achar Flamengo")
    print(f"  FT.SEARCH idx:jogos 'bambi' LIMIT 0 10   # Deve achar São Paulo")
    print(f"  FT.SEARCH idx:jogos 'tigrinho' LIMIT 0 10  # Deve achar Fortune Tiger")
    print(f"  FT.SUGGET ac:jogos 'tig' FUZZY MAX 10")
    print()

if __name__ == '__main__':
    main()

