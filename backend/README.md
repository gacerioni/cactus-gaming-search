# 🚀 Backend - Node.js API

API Node.js/TypeScript que conecta no Redis Cloud via ioredis (TCP/RESP3).

## 📋 Endpoints

### 1. Autocomplete
```bash
GET /api/autocomplete?q=tig
```

### 2. Search
```bash
POST /api/search
Content-Type: application/json

{
  "query": "tigre",
  "filters": {
    "provider": "PG Soft",
    "categoria": "slot"
  }
}
```

### 3. Vector Search
```bash
POST /api/vector-search
Content-Type: application/json

{
  "query": "jogos de tigre asiático com multiplicadores"
}
```

## 🚀 Deploy AWS EC2

### 1. Criar EC2

```
Região: sa-east-1 (São Paulo)
AMI: Ubuntu 24.04 LTS
Tipo: t3.small (2 vCPU, 2GB RAM)
VPC: Mesma do PrivateLink Redis
Security Group:
  - Inbound: 22 (SSH), 80 (HTTP), 443 (HTTPS), 3000 (Node.js)
  - Outbound: All
```

### 2. SSH e Setup

```bash
# SSH
ssh -i sua-key.pem ubuntu@<EC2_IP>

# Atualizar sistema
sudo apt update && sudo apt upgrade -y

# Instalar Node.js 22
curl -fsSL https://deb.nodesource.com/setup_22.x | sudo -E bash -
sudo apt-get install -y nodejs git nginx certbot python3-certbot-nginx

# Clonar projeto
git clone <SEU_REPO_URL>
cd cactus-gaming-search/backend

# Configurar .env
cp .env.example .env
nano .env
```

### 3. Configurar .env

```bash
REDIS_URL=redis://default:PASSWORD@redis-16599.crce196.sa-east-1-2.ec2.cloud.redislabs.com:16599
PORT=3000
NODE_ENV=production
CORS_ORIGIN=https://worker.platformengineer.io
```

### 4. Build e Rodar

```bash
# Instalar dependências (Node.js 22+, npm 10+)
npm install

# Desenvolvimento (hot reload com tsx)
npm run dev

# Build TypeScript
npm run build

# Produção
npm start

# Deve aparecer:
# 🚀 Server running on port 3000
# ✅ Connected to Redis

# Testar endpoint
curl http://localhost:3000/api/search?q=tigre
```

**Stack atualizado (2026):**
- Node.js 22+
- Express 5.0
- TypeScript 5.7
- ESLint 9 (flat config)
- tsx (substitui ts-node-dev deprecado)

### 5. Configurar PM2

```bash
# Instalar PM2
sudo npm install -g pm2

# Iniciar com PM2
pm2 start ecosystem.config.js

# Auto-start no boot
pm2 startup
# Copiar e executar o comando que aparecer

pm2 save

# Verificar
pm2 status
pm2 logs cactus-backend
```

### 6. Configurar Nginx + HTTPS

```bash
# Criar config Nginx
sudo nano /etc/nginx/sites-available/cactus-backend
```

Conteúdo:
```nginx
server {
    listen 80;
    server_name api-backend.platformengineer.io;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
```

```bash
# Ativar site
sudo ln -s /etc/nginx/sites-available/cactus-backend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl restart nginx

# Configurar DNS no GoDaddy ANTES:
# api-backend.platformengineer.io → A → <EC2_IP>

# Aguardar propagação DNS (5-10 min), depois:
sudo certbot --nginx -d api-backend.platformengineer.io
# Escolher: Redirect HTTP to HTTPS

# Testar HTTPS
curl https://api-backend.platformengineer.io/api/search?q=tigre
```

## 🔧 Manutenção

### Ver logs
```bash
pm2 logs cactus-backend
```

### Restart
```bash
pm2 restart cactus-backend
```

### Atualizar código
```bash
git pull
npm run build
pm2 restart cactus-backend
```

### Monitorar
```bash
pm2 monit
```

## 📊 Estrutura

```
backend/
├── src/
│   ├── index.ts              # Express server
│   ├── redis.ts              # Redis client (ioredis)
│   ├── routes/
│   │   ├── autocomplete.ts   # GET /api/autocomplete
│   │   ├── search.ts         # POST /api/search
│   │   └── vectorSearch.ts   # POST /api/vector-search
│   └── utils/
│       └── parser.ts         # Parse Redis responses
├── package.json
├── tsconfig.json
├── ecosystem.config.js       # PM2 config
└── .env
```

