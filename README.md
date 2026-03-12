# 🌵 Cactus Gaming - Redis Search as a Service

**Search-as-a-Service** completo usando Redis, similar ao Algolia/Meilisearch.

**Features:**
- 🔍 **Autocomplete** - Sugestões em tempo real
- 📝 **Full-text Search** - Busca com sinônimos ("mengao" → Flamengo)
- 🔀 **Fuzzy Match** - Tolerância a erros de digitação
- 🧠 **Vector Search** - Busca semântica com IA

## 🌐 URLs em Produção

- **Frontend:** https://8496f414.cactus-demo.pages.dev
- **Worker (API):** https://cactus-worker.platformengineer.workers.dev
- **Backend:** https://api-backend.platformengineer.io

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

- **[DEPLOY_GUIDE.md](DEPLOY_GUIDE.md)** - Guia completo de deploy e re-deploy
- **[TUTORIAL.md](TUTORIAL.md)** - Manutenção do backend no EC2
- **[CLOUDFLARE_SETUP.md](CLOUDFLARE_SETUP.md)** - Setup do Worker e Pages

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
├── seed/              # Python - Popular Redis com embeddings OpenAI
├── backend/           # Node.js - API Express + ioredis (AWS EC2)
├── worker/            # Cloudflare Worker - Edge proxy + CORS
├── frontend/          # Demo HTML (Cloudflare Pages)
│   └── index.html     # Frontend completo
├── games_data.json    # 45 jogos com metadados
└── test-api.sh        # Testes automatizados
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

## 📖 Mais Info

- **Problemas de setup?** Veja [SETUP.md](SETUP.md)
- **Deploy em produção:** Veja [TUTORIAL.md](TUTORIAL.md)

