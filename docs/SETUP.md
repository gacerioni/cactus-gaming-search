# ⚙️ Setup Rápido

## ⚠️ IMPORTANTE: Estrutura do Projeto

Este projeto **NÃO tem `package.json` na raiz**. São 3 componentes independentes:

```
cactus-gaming-search/
├── seed/              # Python - Popular Redis
│   └── requirements.txt
├── backend/           # Node.js API
│   └── package.json   ← npm install AQUI
└── worker/            # Cloudflare Worker
    └── package.json   ← npm install AQUI
```

---

## 🐍 1. Seed (Python)

```bash
cd seed/
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env  # Adicionar REDIS_URL e OPENAI_API_KEY
python seed_production_vectors.py
```

---

## 🟢 2. Backend (Node.js)

```bash
cd backend/
npm install
cp .env.example .env  # Adicionar REDIS_URL e OPENAI_API_KEY
npm run dev
```

---

## ⚡ 3. Worker (Cloudflare)

```bash
cd worker/
npm install
npx wrangler login
npx wrangler deploy
```

---

## ❌ Erros Comuns

### `npm error enoent Could not read package.json`

**Causa:** Você rodou `npm install` na raiz do projeto.

**Solução:** Entre na pasta `backend/` ou `worker/` primeiro:
```bash
cd backend/
npm install
```

### `source: no such file or directory: .venv/bin/activate`

**Causa:** Você não criou o ambiente virtual Python.

**Solução:**
```bash
cd seed/
python3 -m venv .venv
source .venv/bin/activate
```

---

## 📖 Mais Info

- **Quick Start:** Veja [README.md](README.md)
- **Deploy Completo:** Veja [TUTORIAL.md](TUTORIAL.md)

