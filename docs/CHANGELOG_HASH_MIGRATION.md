# 🔄 Changelog - Migração para HASH Schema

## 📅 Data: 2026-03-12

## 🎯 Objetivo

Replicar a experiência **Search-as-a-Service** do projeto Python original, que era superior ao Node.js.

---

## ❌ Problema Identificado

### Python (FUNCIONAVA):
- ✅ Schema: `HASH` (flat)
- ✅ Campo `aliases` indexado como TEXT
- ✅ Sinônimos funcionando ("mengao" → Flamengo)
- ✅ Busca multi-camada (FTS → Fuzzy → Vector)

### Node.js (QUEBRADO):
- ❌ Schema: `JSON` (com subcampos)
- ❌ Sem campo `aliases` flat
- ❌ Sinônimos não funcionavam
- ❌ Busca simples (só FTS)

---

## ✅ Solução Implementada

### 1. **Migração de JSON para HASH**

**Antes:**
```redis
FT.CREATE idx:games ON JSON PREFIX 1 game:
  SCHEMA
    $.nome AS nome TEXT
    $.termos_busca[*] AS termos_busca TEXT  # Array, não funciona bem
```

**Depois:**
```redis
FT.CREATE idx:jogos ON HASH PREFIX 1 jogo:
  SCHEMA
    nome TEXT WEIGHT 5
    aliases TEXT WEIGHT 2  # String flat: "mengao bambi tigrinho..."
```

### 2. **Sinônimos Corrigidos**

```redis
FT.SYNUPDATE idx:jogos syn:mengao mengao mengão fla flamengo
FT.SYNUPDATE idx:jogos syn:bambi bambi são paulo spfc tricolor
```

### 3. **Busca Multi-Camada**

```typescript
// Layer 1: Full-text com sinônimos
FT.SEARCH idx:jogos "mengao"

// Layer 2: Fuzzy fallback
FT.SEARCH idx:jogos "%mengao%"

// Layer 3: Vector search (TODO)
```

---

## 📝 Arquivos Modificados

### Seed:
- ✅ `seed/seed_production_vectors.py`
  - Mudou de `ON JSON` para `ON HASH`
  - Campo `aliases` agora é string flat
  - Sinônimos usando `idx:jogos` (não `idx:games`)
  - Autocomplete usando `ac:jogos` (não `ac:games`)

### Backend:
- ✅ `backend/src/routes/search.ts`
  - Implementou busca multi-camada
  - Mudou de `idx:games` para `idx:jogos`
  - Retorna `searchMethod` (full-text, fuzzy, vector)

- ✅ `backend/src/routes/autocomplete.ts`
  - Mudou de `ac:games` para `ac:jogos`

- ✅ `backend/src/routes/vectorSearch.ts`
  - Mudou de `idx:games` para `idx:jogos`
  - Mudou de `@embedding` para `@description_vector`

- ✅ `backend/src/index.ts`
  - Desabilitou CSP no Helmet (já estava feito)

### Frontend:
- ✅ `frontend/index.html`
  - Removeu botão "Busca Semântica"
  - 1 campo, 1 botão ("Buscar")
  - Mostra qual método foi usado (full-text, fuzzy, vector)
  - Placeholder: "mengao, bambi, tigrinho"

### Documentação:
- ✅ `DEPLOY_GUIDE.md` - Novo arquivo com guia completo
- ✅ `README.md` - Atualizado com nova URL e features
- ✅ `CHANGELOG_HASH_MIGRATION.md` - Este arquivo

---

## 🚀 Como Re-deployar

### 1. No seu Mac:

```bash
cd ~/PycharmProjects/cactus-gaming-search/

git add .
git commit -m "feat: migrar para HASH schema e implementar search-as-a-service"
git push origin main
```

### 2. No servidor Ubuntu (EC2):

```bash
cd ~/cactus-gaming-search/

# Pull
git pull origin main

# Re-seed (OBRIGATÓRIO - schema mudou!)
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

### 3. Testar:

Abra a URL que o Wrangler retornar e teste:
- "mengao" → Deve achar Flamengo
- "bambi" → Deve achar São Paulo
- "tigrinho" → Deve achar Fortune Tiger

---

## 🎯 Resultado Esperado

### Antes:
- ❌ "mengao" → 0 resultados
- ❌ "bambi" → 0 resultados
- ❌ "tigrinho" → Só vector search (lento)

### Depois:
- ✅ "mengao" → Flamengo (via sinônimos)
- ✅ "bambi" → São Paulo (via sinônimos)
- ✅ "tigrinho" → Fortune Tiger (via aliases)
- ✅ Busca inteligente com fallbacks

---

## 📊 Comparação Python vs Node.js

| Feature | Python (Original) | Node.js (Antes) | Node.js (Agora) |
|---------|-------------------|-----------------|-----------------|
| Schema | HASH | JSON | HASH ✅ |
| Aliases | ✅ | ❌ | ✅ |
| Sinônimos | ✅ | ❌ | ✅ |
| Fuzzy | ✅ | ❌ | ✅ |
| Vector | ✅ | ✅ | ✅ |
| Multi-layer | ✅ | ❌ | ✅ |

---

## 🐛 Troubleshooting

### "mengao" ainda não acha Flamengo

**Causa:** Seed não foi executado ou sinônimos não foram criados

**Solução:**
```bash
redis-cli -u $REDIS_URL FT.SYNDUMP idx:jogos
# Se vazio, re-executar seed
```

### Erro "no such index"

**Causa:** Índice ainda está com nome antigo (`idx:games`)

**Solução:**
```bash
redis-cli -u $REDIS_URL FT.DROPINDEX idx:games
cd ~/cactus-gaming-search/seed/
python3 seed_production_vectors.py
```

---

## ✅ Checklist de Deploy

- [ ] Commit e push no Mac
- [ ] Pull no Ubuntu
- [ ] Re-executar seed (OBRIGATÓRIO!)
- [ ] Rebuild backend
- [ ] Restart PM2
- [ ] Re-deploy frontend
- [ ] Testar "mengao", "bambi", "tigrinho"
- [ ] Verificar qual método foi usado (deve ser "full-text")

