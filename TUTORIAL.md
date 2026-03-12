# 📚 Tutorial - Deploy Completo

## Pré-requisitos

- Redis Cloud account
- OpenAI API key
- AWS EC2 (opcional, para produção)
- Cloudflare account (opcional, para edge)

---

## 1️⃣ Seed Redis Cloud

### Criar Redis Cloud Database
1. Acesse https://redis.io/cloud
2. Crie database com módulos: **RediSearch** + **RedisJSON**
3. Copie a connection string

### Popular dados
```bash
cd seed/
python3 -m venv .venv
source .venv/bin/activate
cp .env.example .env
nano .env
```

Adicione:
```
REDIS_URL=redis://default:PASSWORD@host:port
OPENAI_API_KEY=sk-proj-xxxxx
```

Execute:
```bash
pip install -r requirements.txt
python seed_production_vectors.py
```

Deve aparecer:
```
✅ Connected to Redis
✅ Índice principal criado (idx:games)
✅ Autocomplete criado (ac:games)
✅ 45 jogos inseridos
```

---

## 2️⃣ Backend Local

```bash
cd backend/
cp .env.example .env
nano .env
```

Adicione:
```
REDIS_URL=redis://default:PASSWORD@host:port
OPENAI_API_KEY=sk-proj-xxxxx
PORT=3000
NODE_ENV=development
```

Execute:
```bash
npm install
npm run dev
```

Teste:
```bash
curl "http://localhost:3000/api/autocomplete?q=tig"
```

---

## 3️⃣ Deploy Backend (AWS EC2)

### Criar EC2
- **Região:** sa-east-1 (São Paulo)
- **AMI:** Ubuntu 24.04 LTS
- **Tipo:** t3.small
- **Security Group:** 22, 80, 443, 3000

### SSH e Setup
```bash
ssh ubuntu@IP

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs

# Instalar PM2
sudo npm install -g pm2

# Clone projeto
git clone SEU_REPO
cd cactus-gaming-search/backend/

# Configurar .env
cp .env.example .env
nano .env

# Build e rodar
npm install
npm run build
pm2 start ecosystem.config.js
pm2 save
pm2 startup
```

### Nginx + SSL
```bash
sudo apt install nginx certbot python3-certbot-nginx

# Configurar Nginx
sudo nano /etc/nginx/sites-available/default
```

Adicione:
```nginx
server {
    listen 80;
    server_name api-backend.SEU_DOMINIO.com;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
sudo nginx -t
sudo systemctl restart nginx
sudo certbot --nginx -d api-backend.SEU_DOMINIO.com
```

---

## 4️⃣ Deploy Worker (Cloudflare)

```bash
cd worker/
npm install
npx wrangler login
```

Edite `wrangler.toml`:
```toml
name = "cactus-worker"
main = "src/index.ts"
compatibility_date = "2026-03-12"

[vars]
BACKEND_URL = "https://api-backend.SEU_DOMINIO.com"
```

Deploy:
```bash
npx wrangler deploy
```

Configurar custom domain no Cloudflare Dashboard.

---

## 5️⃣ Testar Produção

```bash
# Autocomplete
curl "https://worker.SEU_DOMINIO.com/api/autocomplete?q=tig"

# Search
curl -X POST https://worker.SEU_DOMINIO.com/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tigre"}'

# Vector Search
curl -X POST https://worker.SEU_DOMINIO.com/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "jogos de tigre asiático"}'
```

---

## 🔧 Troubleshooting

**Erro: Could not connect to Redis**
```bash
redis-cli -u $REDIS_URL PING
```

**Backend não inicia**
```bash
pm2 logs cactus-backend
```

**Worker não conecta no backend**
- Verificar CORS no backend `.env`
- Verificar `BACKEND_URL` no wrangler.toml

---

✅ **Pronto!** Seu Search-as-a-Service está no ar.

