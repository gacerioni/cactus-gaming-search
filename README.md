# 🌵 Cactus Gaming - Redis Search as a Service

**Search-as-a-Service** completo usando Redis, similar ao Algolia/Meilisearch.

**Features:**
- 🔍 **Autocomplete** - Sugestões em tempo real
- 📝 **Full-text Search** - Busca com sinônimos ("mengao" → Flamengo)
- 🔀 **Fuzzy Match** - Tolerância a erros de digitação
- 🧠 **Vector Search** - Busca semântica com IA

## 🌐 URLs em Produção

- **Frontend:** https://128b1c88.cactus-demo.pages.dev
- **Backend API:** http://18.212.93.54:3000
- **Servidor:** AWS EC2 (Ubuntu) - 18.212.93.54

## 🎯 Experiência de Busca

Digite **"mengao"** → Acha Flamengo ✅
Digite **"bambi"** → Acha São Paulo ✅
Digite **"tigrinho"** → Acha Fortune Tiger ✅

**Como funciona:**
1. Autocomplete mostra sugestões enquanto digita
2. Busca usa sinônimos (mengao = flamengo = fla)
3. Se não achar, tenta fuzzy match
4. Se ainda não achar, usa vector search (semântica)

> **⚠️ IMPORTANTE:** Este projeto tem 4 componentes separados:
> - `seed/` - Script Python (popular Redis com HASH schema)
> - `backend/` - API Node.js (AWS EC2)
> - `worker/` - Cloudflare Worker (Edge Proxy)
> - `frontend/` - Demo HTML (Cloudflare Pages)
>
> **Não existe `package.json` na raiz!** Entre em cada pasta antes de rodar `npm install`.

## 📚 Documentação

Toda a documentação está organizada em [`docs/`](./docs/):

- **[docs/SETUP.md](./docs/SETUP.md)** - Configuração inicial do projeto
- **[docs/TUTORIAL.md](./docs/TUTORIAL.md)** - Tutorial de uso
- **[docs/DEPLOY_GUIDE.md](./docs/DEPLOY_GUIDE.md)** - Guia completo de deploy
- **[docs/CLOUDFLARE_SETUP.md](./docs/CLOUDFLARE_SETUP.md)** - Setup do Cloudflare
- **[docs/README.md](./docs/README.md)** - Índice completo da documentação

## 🚀 Scripts

Scripts de deploy e manutenção em [`scripts/`](./scripts/):

- **[scripts/deploy_frontend.sh](./scripts/deploy_frontend.sh)** - Deploy rápido do frontend (~30s)
- **[scripts/deploy_full_reset.sh](./scripts/deploy_full_reset.sh)** - Deploy completo com reindexação (~5min)
- **[scripts/test-api.sh](./scripts/test-api.sh)** - Testes da API
- **[scripts/README.md](./scripts/README.md)** - Documentação dos scripts

---

## 🚀 Quick Start

### 1. Seed Redis
```bash
cd seed/
python3 -m venv .venv
source .venv/bin/activate
cp .env.example .env  # Adicionar REDIS_URL e OPENAI_API_KEY
pip install -r requirements.txt
python seed_production_vectors.py
```

### 2. Rodar Backend
```bash
# IMPORTANTE: Entrar na pasta backend primeiro!
cd backend/

# Configurar credenciais
cp .env.example .env  # Adicionar REDIS_URL e OPENAI_API_KEY

# Instalar e rodar
npm install
npm run dev
```

### 3. Testar
```bash
curl "http://localhost:3000/api/autocomplete?q=tig"
```

---

## 📁 Estrutura

```
cactus-gaming-search/
├── docs/                      # 📚 Documentação completa
│   ├── README.md              # Índice da documentação
│   ├── SETUP.md               # Setup inicial
│   ├── TUTORIAL.md            # Tutorial de uso
│   ├── DEPLOY_GUIDE.md        # Guia de deploy
│   └── CLOUDFLARE_SETUP.md    # Setup do Cloudflare
├── scripts/                   # 🚀 Scripts de deploy
│   ├── README.md              # Documentação dos scripts
│   ├── deploy_frontend.sh     # Deploy rápido do frontend
│   ├── deploy_full_reset.sh   # Deploy completo com reindexação
│   └── test-api.sh            # Testes da API
├── seed/                      # 🌱 Python - Popular Redis com embeddings
│   ├── seed_production_vectors.py
│   ├── clean_redis.py
│   └── requirements.txt
├── backend/                   # 🔧 Node.js - API Express + ioredis
│   ├── src/
│   ├── package.json
│   └── tsconfig.json
├── frontend/                  # 🎨 Frontend HTML (Cloudflare Pages)
│   └── index.html
├── worker/                    # ⚡ Cloudflare Worker (não usado atualmente)
├── games_data.json            # 🎮 154 jogos com metadados e aliases
└── README.md                  # Este arquivo
```

---

## 🎯 API Endpoints

**Autocomplete**
```bash
GET /api/autocomplete?q=tig
```

**Search**
```bash
POST /api/search
{"query": "tigre", "filters": {"provider": "PG Soft"}}
```

**Vector Search**
```bash
POST /api/vector-search
{"query": "jogos de tigre asiático"}
```

---

## 🔧 Stack

- **Redis Cloud** - RediSearch + RedisJSON + Vector (HNSW)
- **OpenAI** - text-embedding-3-small (1536D)
- **Node.js 22** - Express 5 + TypeScript 5.7 + ioredis
- **Cloudflare Workers** - Edge global
- **AWS EC2** - Backend (São Paulo)

---

## 📊 Estatísticas do Projeto

- **154 jogos** cadastrados com aliases brasileiros
- **Busca híbrida:** FTS + Fuzzy + Vector Search (KNN)
- **Embeddings:** OpenAI text-embedding-3-small (1536D)
- **Performance:** ~200-600ms por busca
- **Recall:** 8-15 resultados relevantes por query

---

## 📖 Mais Info

- **Problemas de setup?** Veja [docs/SETUP.md](./docs/SETUP.md)
- **Deploy em produção:** Veja [docs/DEPLOY_GUIDE.md](./docs/DEPLOY_GUIDE.md)
- **Dúvidas sobre scripts:** Veja [scripts/README.md](./scripts/README.md)
- **Documentação completa:** Veja [docs/README.md](./docs/README.md)

