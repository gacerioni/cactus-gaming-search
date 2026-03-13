"""
Script de teste para investigar o bug de truncamento de aliases
"""
import json
from pathlib import Path
from redis_client import get_redis_client

# Carregar dados
GAMES_DATA_FILE = Path(__file__).parent.parent / "games_data.json"

print("=" * 60)
print("🔍 TESTE DE ALIASES - INVESTIGAÇÃO DE BUG")
print("=" * 60)

# 1. Carregar JSON
print(f"\n1. Carregando {GAMES_DATA_FILE}...")
with open(GAMES_DATA_FILE, 'r', encoding='utf-8') as f:
    data = json.load(f)

fortune_tiger = [g for g in data['games'] if g['nome'] == 'Fortune Tiger'][0]
print(f"   Aliases no JSON: {fortune_tiger['aliases']}")
print(f"   Tamanho: {len(fortune_tiger['aliases'])} caracteres")

# 2. Conectar Redis
print("\n2. Conectando ao Redis...")
client = get_redis_client()
print("   ✓ Conectado")

# 3. Testar salvamento direto
print("\n3. Teste 1 - Salvamento direto com hset simples...")
client.hset('test:direct', 'aliases', fortune_tiger['aliases'])
stored_direct = client.hget('test:direct', 'aliases').decode('utf-8')
print(f"   Armazenado: {stored_direct}")
print(f"   Tamanho: {len(stored_direct)} caracteres")
print(f"   ✓ Match: {stored_direct == fortune_tiger['aliases']}")

# 4. Testar salvamento com mapping (como no seed)
print("\n4. Teste 2 - Salvamento com mapping (como no seed)...")
hash_data = {
    'id_jogo': fortune_tiger['id_jogo'],
    'nome': fortune_tiger['nome'],
    'provider': fortune_tiger['provider'],
    'aliases': fortune_tiger['aliases'],
    'popularity': str(fortune_tiger.get('popularity', 50)),
    'description': fortune_tiger.get('description', ''),
    'categoria': fortune_tiger.get('categoria', 'slot'),
    'tags': fortune_tiger.get('tags', '')
}

print(f"   hash_data['aliases']: {hash_data['aliases']}")
print(f"   Tamanho: {len(hash_data['aliases'])} caracteres")

client.hset('test:mapping', mapping=hash_data)
stored_mapping = client.hget('test:mapping', 'aliases').decode('utf-8')
print(f"   Armazenado: {stored_mapping}")
print(f"   Tamanho: {len(stored_mapping)} caracteres")
print(f"   ✓ Match: {stored_mapping == fortune_tiger['aliases']}")

# 5. Verificar o que está em jogo:1 (se existir)
print("\n5. Verificando jogo:1 atual no Redis...")
if client.exists('jogo:1'):
    current_aliases = client.hget('jogo:1', 'aliases')
    if current_aliases:
        current_aliases = current_aliases.decode('utf-8')
        print(f"   Aliases atuais: {current_aliases}")
        print(f"   Tamanho: {len(current_aliases)} caracteres")
        print(f"   ✓ Match com JSON: {current_aliases == fortune_tiger['aliases']}")
    else:
        print("   ⚠️ Campo 'aliases' não existe")
else:
    print("   ⚠️ jogo:1 não existe")

# Cleanup
client.delete('test:direct', 'test:mapping')

print("\n" + "=" * 60)
print("✅ TESTE COMPLETO")
print("=" * 60)

