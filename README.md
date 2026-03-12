# 🌵 Cactus Gaming - Redis Search as a Service

Search-as-a-Service para casas de apostas com Redis Cloud.

**Features:** Autocomplete • Full-text Search • Vector Search (IA) • Edge Computing

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
cd backend/
cp .env.example .env  # Adicionar REDIS_URL e OPENAI_API_KEY
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
├── seed/          # Python - Popular Redis com embeddings OpenAI
├── backend/       # Node.js - API Express + ioredis
├── worker/        # Cloudflare Worker - Edge proxy
└── games_data.json
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

Veja [TUTORIAL.md](TUTORIAL.md) para deploy completo em produção.

