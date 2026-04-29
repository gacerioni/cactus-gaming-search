"""
Seed Redis Cloud com schema de produção + Vector Search
Baseado no backoffice Cactus Gaming

SCHEMA: HASH (flat) - igual ao Python original
Permite aliases, sinônimos e busca multi-camada
"""
import sys
import json
import hashlib
import re
import unicodedata
from pathlib import Path
from redis_client import get_redis_client
from embeddings import get_embedding_generator

# Carregar dados do arquivo JSON existente
# Sempre usar o arquivo da raiz do projeto, não o da pasta seed
PROJECT_ROOT = Path(__file__).resolve().parent.parent
GAMES_DATA_FILE = PROJECT_ROOT / "games_data.json"
SEARCH_INTENTS_FILE = PROJECT_ROOT / "search_intents.json"
PROTECTED_SPELL_DICT = "dict:search_protected"

AUTOCOMPLETE_STOP_TERMS = {
    "jogo", "jogos", "joguinho", "proximo", "próximo", "vs", "versus",
    "serie", "série", "brasil", "brasileiro", "brasileira", "casino",
    "live", "sport", "sportsbet", "play", "soft", "gaming", "game"
}


def normalize_query(value: str) -> str:
    """Normaliza queries/termos do mesmo jeito que o Worker."""
    value = (value or "").lower().strip()
    value = unicodedata.normalize("NFD", value)
    value = "".join(ch for ch in value if unicodedata.category(ch) != "Mn")
    value = re.sub(r"[^a-z0-9]+", " ", value)
    return re.sub(r"\s+", " ", value).strip()


def intent_key(term: str) -> str:
    normalized = normalize_query(term)
    digest = hashlib.sha256(normalized.encode("utf-8")).hexdigest()
    return f"intent:{digest}"


def load_games_data():
    """Carrega dados do games_data.json"""
    try:
        with open(GAMES_DATA_FILE, 'r', encoding='utf-8') as f:
            data = json.load(f)
        print(f"✅ Loaded {len(data['games'])} games from games_data.json")

        # DEBUG: Verificar aliases do Fortune Tiger
        ft = [g for g in data['games'] if g['nome'] == 'Fortune Tiger']
        if ft:
            print(f"🐯 DEBUG - Fortune Tiger aliases no JSON: {ft[0]['aliases'][:80]}...")
            print(f"🐯 DEBUG - Tamanho completo: {len(ft[0]['aliases'])} caracteres")

        return data
    except FileNotFoundError:
        print(f"❌ ERROR: {GAMES_DATA_FILE} not found!")
        sys.exit(1)


def load_search_intents():
    """Carrega intents brasileiras curadas para autocomplete, boost e spellcheck."""
    if not SEARCH_INTENTS_FILE.exists():
        print("⚠️  search_intents.json não encontrado; seguindo sem intents curados")
        return {"version": "none", "protected_spell_terms": [], "intents": []}

    with open(SEARCH_INTENTS_FILE, "r", encoding="utf-8") as f:
        data = json.load(f)
    print(f"✅ Loaded {len(data.get('intents', []))} search intents ({data.get('version')})")
    return data


def scan_delete(client, pattern: str):
    """Remove chaves auxiliares sem usar KEYS em produção."""
    count = 0
    batch = []
    for key in client.scan_iter(match=pattern, count=500):
        batch.append(key)
        if len(batch) >= 500:
            client.delete(*batch)
            count += len(batch)
            batch = []
    if batch:
        client.delete(*batch)
        count += len(batch)
    return count


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
        'description', 'TEXT', 'WEIGHT', '1',  # ← Descrição do jogo
        'provider', 'TAG', 'SORTABLE',
        'categoria', 'TAG', 'SORTABLE',  # ← slot, crash, live, etc
        'tags', 'TEXT',  # ← FS, CERT, etc
        'id_jogo', 'TAG',
        'slug', 'TEXT',
        'image', 'TEXT',
        'rtp', 'TEXT',
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
            'popularity': str(game_data.get('popularity', 50)),
            'description': game_data.get('description', ''),
            'categoria': game_data.get('categoria', 'slot'),
            'tags': game_data.get('tags', ''),
            'image': game_data.get('image', ''),
            'rtp': str(game_data.get('rtp') or ''),
            'slug': game_data.get('slug', ''),
        }

        # Adicionar embedding se existir
        if game_data['id_jogo'] in embedding_map:
            embedding = embedding_map[game_data['id_jogo']]
            # Converter para bytes (FLOAT32)
            embedding_bytes = struct.pack(f'{len(embedding)}f', *embedding)
            hash_data['description_vector'] = embedding_bytes

        # Salvar no Redis como HASH
        client.hset(key, mapping=hash_data)

        # Debug: verificar se aliases foram salvos corretamente
        if game_data['nome'] == 'Fortune Tiger':
            stored_aliases_raw = client.hget(key, 'aliases')
            stored_aliases = stored_aliases_raw.decode('utf-8') if isinstance(stored_aliases_raw, bytes) else stored_aliases_raw
            print(f"  ✓ {game_data['nome']} ({game_data['provider']})")
            print(f"    DEBUG - Aliases originais: {game_data['aliases'][:80]}...")
            print(f"    DEBUG - Aliases armazenados: {stored_aliases[:80]}...")
            print(f"    DEBUG - Match: {stored_aliases == game_data['aliases']}")
        else:
            print(f"  ✓ {game_data['nome']} ({game_data['provider']})")

def add_suggestion(suggestions, text, score, payload, source, canonical=None):
    """Mantém a maior pontuação por texto para evitar alias genérico vencer intent curado."""
    text = (text or "").strip()
    if len(text) < 2:
        return

    key = text.lower()
    normalized = normalize_query(text)
    if normalized in AUTOCOMPLETE_STOP_TERMS:
        return

    existing = suggestions.get(key)
    if existing is None or score > existing["score"]:
        suggestions[key] = {
            "text": canonical or text,
            "score": float(score),
            "payload": str(payload),
            "source": source,
        }


def seed_autocomplete(client, games, intents_config):
    """Seed de autocomplete usando FT.SUGADD"""
    print("\n🔍 Populando autocomplete...")

    suggestion_key = "ac:jogos"

    # Limpar sugestões antigas
    try:
        client.delete(suggestion_key)
    except:
        pass

    suggestions = {}

    # 1) Intents curados têm prioridade máxima.
    for intent in intents_config.get("intents", []):
        boost = float(intent.get("boost", 800))
        id_jogo = intent["id_jogo"]
        canonical = intent["canonical"]

        add_suggestion(suggestions, canonical, boost + 25, id_jogo, "intent", canonical)
        for term in intent.get("terms", []):
            display = canonical if normalize_query(term) == normalize_query(canonical) else term
            add_suggestion(suggestions, display, boost, id_jogo, "intent")

    # 2) Catálogo oficial continua entrando, mas sem atropelar intent.
    for game in games:
        popularity = float(game.get("popularity", 50) or 50)
        add_suggestion(
            suggestions,
            game["nome"],
            popularity * 5,
            game["id_jogo"],
            "name",
            game["nome"],
        )

        aliases = game.get("aliases", "").split()
        for alias in aliases[:12]:
            if len(alias) > 2:
                add_suggestion(
                    suggestions,
                    alias,
                    popularity * 0.65,
                    game["id_jogo"],
                    "alias",
                )

    suggestion_count = 0
    pipe = client.pipeline(transaction=False)
    BATCH_SIZE = 500

    for suggestion in sorted(suggestions.values(), key=lambda item: item["score"], reverse=True):
        pipe.execute_command(
            'FT.SUGADD', suggestion_key,
            suggestion["text"],
            suggestion["score"],
            'PAYLOAD', suggestion["payload"]
        )
        suggestion_count += 1

        # Flush em batches pra não acumular demais
        if suggestion_count % BATCH_SIZE == 0:
            pipe.execute()
            pipe = client.pipeline(transaction=False)

    # Flush restante
    pipe.execute()
    print(f"  ✓ {suggestion_count} sugestões adicionadas")


def seed_search_intents(client, intents_config):
    """Seed de intents determinísticos para boost, rewrite e telemetria no Worker."""
    print("\n🎯 Criando intents curados...")

    removed = scan_delete(client, "intent:*")
    if removed:
        print(f"  ✓ {removed} intents antigos removidos")

    pipe = client.pipeline(transaction=False)
    count = 0

    for intent in intents_config.get("intents", []):
        terms = set(intent.get("terms", []))
        terms.add(intent["canonical"])

        for term in terms:
            normalized = normalize_query(term)
            if not normalized:
                continue

            pipe.hset(intent_key(term), mapping={
                "id": intent["id"],
                "term": term,
                "normalized": normalized,
                "canonical": intent["canonical"],
                "id_jogo": intent["id_jogo"],
                "intent": intent.get("intent", ""),
                "categoria": intent.get("categoria", ""),
                "provider": intent.get("provider", ""),
                "rewrite": intent.get("rewrite", intent["canonical"]),
                "boost": str(intent.get("boost", 0)),
            })
            count += 1

            if count % 500 == 0:
                pipe.execute()
                pipe = client.pipeline(transaction=False)

    pipe.execute()
    print(f"  ✓ {count} termos de intent gravados")


def seed_spellcheck_dictionary(client, intents_config):
    """Protege termos que o FT.SPELLCHECK não deve corrigir para palavras erradas."""
    terms = sorted({
        normalize_query(term)
        for term in intents_config.get("protected_spell_terms", [])
        if normalize_query(term)
    })

    if not terms:
        return

    print("\n🧯 Criando dicionário de spellcheck protegido...")
    try:
        added = client.execute_command("FT.DICTADD", PROTECTED_SPELL_DICT, *terms)
        print(f"  ✓ {added} termos adicionados/confirmados em {PROTECTED_SPELL_DICT}")
    except Exception as e:
        print(f"  ⚠️  Não foi possível criar dicionário protegido: {e}")


def synonym_groups_from_intents(intents_config):
    """Cria grupos de sinônimos de termos unitários a partir dos intents."""
    groups = []
    for intent in intents_config.get("intents", []):
        terms = []
        for term in intent.get("synonyms", []):
            if " " not in normalize_query(term):
                terms.append(term.lower())

        terms = sorted(set(terms))
        if len(terms) >= 2:
            groups.append({
                "id": f"syn:{intent['id']}",
                "terms": terms,
            })
    return groups


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
    intents_config = load_search_intents()
    games = data['games']
    synonym_groups = data.get('synonym_groups', []) + synonym_groups_from_intents(intents_config)
    
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
    
    # 3. Seed de autocomplete e intents
    seed_autocomplete(client, games, intents_config)
    seed_search_intents(client, intents_config)
    seed_spellcheck_dictionary(client, intents_config)
    
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
    print(f"  • {len(intents_config.get('intents', []))} intents curados")
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
