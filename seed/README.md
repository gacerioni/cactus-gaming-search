# 🌱 Seed - Popular Redis Cloud

Script Python para criar índices e popular dados no Redis Cloud com embeddings OpenAI.

## 📋 O Que Faz

1. ✅ Cria índice `idx:games` (RedisJSON + Vector Search)
2. ✅ Popula 45 jogos com embeddings OpenAI (1536D)
3. ✅ Cria autocomplete `ac:games`
4. ✅ Configura sinônimos (FT.SYNUPDATE)

## 🚀 Como Usar

### 1. Criar Ambiente Virtual

```bash
python3 -m venv .venv
source .venv/bin/activate  # No Windows: .venv\Scripts\activate
```

### 2. Instalar Dependências

```bash
pip install -r requirements.txt
```

### 3. Configurar .env

```bash
cp .env.example .env
nano .env
```

Conteúdo do `.env`:
```bash
REDIS_URL=redis://default:PASSWORD@redis-16599.crce196.sa-east-1-2.ec2.cloud.redislabs.com:16599
EMBEDDING_PROVIDER=openai
OPENAI_API_KEY=sk-proj-xxxxx
```

### 4. Rodar Seed

```bash
python seed_production_vectors.py
```

**Saída esperada:**
```
🌵 CACTUS GAMING - SEED PRODUÇÃO COM VECTORS
============================================================
✅ Connected to Redis
✅ Redis Search module verified
🔧 Criando índices...
  ✓ Índice principal criado (idx:games) com vector search
🎮 Inserindo 45 jogos...
🧠 Gerando embeddings com OpenAI...
  ✓ Fortune Tiger (PG Soft)
  ✓ Aviator (Spribe)
  ...
💡 Criando sugestões de autocomplete...
  ✓ Fortune Tiger: 6 sugestões
  ...
🔄 Criando sinônimos...
  ✓ syn_tigre: tigre, tigrinho, jogo do tigre, fortune tiger
  ...
============================================================
✅ SEED COMPLETO!
============================================================
📊 Estatísticas:
  • 45 jogos cadastrados
  • 45 embeddings gerados (OpenAI 1536D)
  • Índice: idx:games (TEXT + TAG + VECTOR)
  • Autocomplete: ac:games
```

## 🧪 Testar no Redis

```bash
# Testar search
redis-cli -u $REDIS_URL
> FT.SEARCH idx:games "tigre" LIMIT 0 10

# Testar autocomplete
> FT.SUGGET ac:games "tig" FUZZY MAX 10

# Testar vector search
> FT.SEARCH idx:games "*=>[KNN 5 @embedding $vec]" PARAMS 2 vec <embedding_blob> DIALECT 2
```

## 📊 Schema Criado

### Índice Principal (idx:games)
```redis
FT.CREATE idx:games ON JSON PREFIX 1 game:
  SCHEMA
    $.nome AS nome TEXT SORTABLE PHONETIC dm:pt
    $.provider AS provider TAG SORTABLE
    $.categoria AS categoria TAG
    $.descricao AS descricao TEXT
    $.termos_busca[*] AS termos_busca TEXT
    $.embedding AS embedding VECTOR HNSW 6
      TYPE FLOAT32
      DIM 1536
      DISTANCE_METRIC COSINE
```

### Autocomplete (ac:games)
- Nome oficial: score 1.0
- Termos de busca: score 0.9
- Provider: score 0.7

### Sinônimos
- `syn_tigre`: tigre, tigrinho, jogo do tigre, fortune tiger
- `syn_aviador`: aviator, aviador, aviao, jogo do aviãozinho
- `syn_olympus`: olympus, olimpus, gates of olympus
- E mais...

## ⏱️ Tempo de Execução

- **Sem embeddings**: ~5 segundos
- **Com embeddings OpenAI**: ~2-3 minutos (45 jogos)

## 🔧 Troubleshooting

### Erro: "OPENAI_API_KEY not found"
```bash
# Verificar .env
cat .env | grep OPENAI_API_KEY
```

### Erro: "Could not connect to Redis"
```bash
# Testar conexão
redis-cli -u $REDIS_URL PING
```

### Erro: "Index already exists"
```bash
# Dropar índice existente
redis-cli -u $REDIS_URL FT.DROPINDEX idx:games
# Rodar seed novamente
python seed_production_vectors.py
```

## 📝 Arquivos

- `seed_production_vectors.py` - Script principal
- `embeddings.py` - Gerador OpenAI embeddings
- `redis_client.py` - Cliente Redis
- `games_data.json` - Dados dos jogos
- `requirements.txt` - Dependências Python

