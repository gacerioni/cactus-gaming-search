# 🎨 Frontend - Cactus Gaming Search

Demo frontend para testar a API de busca.

## 🌐 URL em Produção

**Live Demo:** https://defbbe54.cactus-demo.pages.dev

---

## 📁 Arquivos

- `index.html` - Frontend completo (HTML + CSS + JavaScript)
- Conecta no Worker: `https://cactus-worker.platformengineer.workers.dev`

---

## 🚀 Deploy (Cloudflare Pages)

### Primeira vez:

```bash
cd ~/cactus-gaming-search/

# Deploy
npx wrangler pages deploy frontend --project-name=cactus-demo
```

### Atualizações:

```bash
# Editar frontend/index.html
nano frontend/index.html

# Re-deploy
npx wrangler pages deploy frontend --project-name=cactus-demo
```

---

## 🧪 Testar Localmente

```bash
# Abrir no navegador
open frontend/index.html

# Ou servir com Python
cd frontend/
python3 -m http.server 8000
# Acesse: http://localhost:8000
```

**Nota:** Certifique-se que `API_URL` aponta para o Worker em produção!

---

## ⚙️ Configuração

Edite a linha 163 de `index.html`:

```javascript
// Produção
const API_URL = 'https://cactus-worker.platformengineer.workers.dev';

// Desenvolvimento local
// const API_URL = 'http://localhost:3000';
```

---

## 🎯 Features

- ✅ Autocomplete com fuzzy matching
- ✅ Full-text search com filtros
- ✅ Vector search (IA semântica)
- ✅ UI responsiva
- ✅ Tratamento de erros
- ✅ Loading states

---

## 📊 Arquitetura

```
Frontend (Cloudflare Pages)
   ↓ HTTPS
Worker (Edge Proxy)
   ↓ HTTPS
Backend (AWS EC2)
   ↓ TCP
Redis Cloud
```

