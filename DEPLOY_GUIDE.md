# 🚀 Guia Completo de Deploy - Cactus Gaming Search

## 📋 Visão Geral

Este projeto implementa um **Search-as-a-Service** completo usando Redis, similar ao Algolia/Meilisearch.

### Arquitetura:

```
Frontend (Cloudflare Pages)
   ↓
Worker (Cloudflare Workers) 
   ↓
Backend (AWS EC2 + Node.js)
   ↓
Redis Cloud (RediSearch + Vector)
```

### Features de Busca:

1. **Autocomplete** (`FT.SUGGET`) - Sugestões enquanto digita
2. **Full-text Search** (`FT.SEARCH`) - Busca com sinônimos
3. **Fuzzy Match** - Tolerância a erros de digitação
4. **Vector Search** - Busca semântica (fallback final)

---

## 🔧 Schema Redis

**IMPORTANTE:** Mudamos de `JSON` para `HASH` (schema flat) para suportar aliases!

### Índice: `idx:jogos`

```redis
FT.CREATE idx:jogos ON HASH PREFIX 1 jogo:
  SCHEMA
    nome TEXT WEIGHT 5 SORTABLE
    aliases TEXT WEIGHT 2          # ← CRÍTICO! "mengao bambi tigrinho..."
    provider TAG SORTABLE
    id_jogo TAG
    popularity NUMERIC SORTABLE
    description_vector VECTOR FLAT 6 TYPE FLOAT32 DIM 1536 DISTANCE_METRIC COSINE
```

### Autocomplete: `ac:jogos`

```redis
FT.SUGADD ac:jogos "Fortune Tiger" 100 PAYLOAD "1"
FT.SUGADD ac:jogos "tigrinho" 80 PAYLOAD "1"
```

### Sinônimos:

```redis
FT.SYNUPDATE idx:jogos syn:mengao mengao mengão fla flamengo
FT.SYNUPDATE idx:jogos syn:bambi bambi são paulo spfc tricolor
FT.SYNUPDATE idx:jogos syn:tigre tigre tigrinho tigrinhu fortune tiger
```

---

## 📦 1. SEED DO REDIS (Primeiro Deploy)

### No servidor Ubuntu (EC2):

```bash
cd ~/cactus-gaming-search/seed/

# Verificar variáveis de ambiente
cat ~/.bashrc | grep REDIS_URL
cat ~/.bashrc | grep OPENAI_API_KEY

# Executar seed
python3 seed_production_vectors.py
```

### Verificar se funcionou:

```bash
# Testar sinônimos
redis-cli -u $REDIS_URL FT.SYNDUMP idx:jogos

# Testar busca "mengao" (deve achar Flamengo)
redis-cli -u $REDIS_URL FT.SEARCH idx:jogos "mengao" LIMIT 0 5

# Testar busca "bambi" (deve achar São Paulo)
redis-cli -u $REDIS_URL FT.SEARCH idx:jogos "bambi" LIMIT 0 5

# Testar autocomplete
redis-cli -u $REDIS_URL FT.SUGGET ac:jogos "tig" FUZZY MAX 10
```

---

## 🖥️ 2. DEPLOY DO BACKEND (Node.js)

### No servidor Ubuntu (EC2):

```bash
cd ~/cactus-gaming-search/

# Pull das mudanças
git pull origin main

# Rebuild
cd backend/
npm run build

# Restart com PM2
pm2 restart cactus-backend

# Verificar logs
pm2 logs cactus-backend --lines 20
```

### Testar backend:

```bash
# Teste 1: Autocomplete
curl "https://api-backend.platformengineer.io/api/autocomplete?q=tig"

# Teste 2: Search
curl -X POST "https://api-backend.platformengineer.io/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "mengao"}'
```

---

## ☁️ 3. DEPLOY DO FRONTEND (Cloudflare Pages)

### No servidor Ubuntu (EC2):

```bash
cd ~/cactus-gaming-search/

# Deploy do frontend
npx wrangler pages deploy frontend --project-name=cactus-demo
```

**Vai retornar uma URL tipo:**
```
✨ Deployment complete! Take a peek over at https://8496f414.cactus-demo.pages.dev
```

---

## ✅ 4. TESTAR END-TO-END

### Abra no navegador:

```
https://8496f414.cactus-demo.pages.dev
```

### Testes obrigatórios:

1. **Digite "mengao"** → Deve achar jogos do Flamengo
2. **Digite "bambi"** → Deve achar jogos do São Paulo
3. **Digite "tigrinho"** → Deve achar Fortune Tiger
4. **Digite "tig"** → Autocomplete deve sugerir "tigre", "tigrinho"

---

## 🔄 Re-deploy Completo (Quando mudar código)

### No seu Mac:

```bash
cd ~/PycharmProjects/cactus-gaming-search/

# Commit e push
git add .
git commit -m "feat: implementar search-as-a-service com HASH schema"
git push origin main
```

### No servidor Ubuntu:

```bash
cd ~/cactus-gaming-search/

# Pull
git pull origin main

# Re-seed (se mudou games_data.json ou schema)
cd seed/
python3 seed_production_vectors.py

# Rebuild backend
cd ../backend/
npm run build
pm2 restart cactus-backend

# Re-deploy frontend
cd ..
npx wrangler pages deploy frontend --project-name=cactus-demo
```

---

## 🐛 Troubleshooting

### Problema: "mengao" não acha Flamengo

**Causa:** Sinônimos não foram criados

**Solução:**
```bash
redis-cli -u $REDIS_URL FT.SYNDUMP idx:jogos
# Se vazio, re-executar seed
```

### Problema: CORS Failed

**Causa:** Helmet bloqueando Worker

**Solução:** Já foi corrigido em `backend/src/index.ts`

### Problema: Autocomplete não funciona

**Causa:** Chave errada (`ac:games` vs `ac:jogos`)

**Solução:** Já foi corrigido em `backend/src/routes/autocomplete.ts`

---

## 📊 URLs de Produção

- **Frontend:** https://8496f414.cactus-demo.pages.dev
- **Worker:** https://cactus-worker.platformengineer.workers.dev
- **Backend:** https://api-backend.platformengineer.io
- **Redis:** Redis Cloud (via `$REDIS_URL`)

