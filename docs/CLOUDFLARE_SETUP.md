# ☁️ Cloudflare Worker - Setup Completo

## 📋 O que você tem agora

✅ Backend rodando: `https://api-backend.platformengineer.io`  
✅ Redis Cloud conectado  
✅ OpenAI funcionando  

**Falta:** Edge proxy (Cloudflare Worker) para cache global e CORS

---

## 🎯 Por que usar Cloudflare Worker?

- **300+ datacenters globais** - Latência < 50ms em qualquer lugar do mundo
- **Cache automático** - Reduz carga no backend
- **CORS simplificado** - Permite qualquer frontend consumir a API
- **DDoS protection** - Proteção automática
- **Free tier generoso** - 100k requests/dia grátis

---

## 1️⃣ Criar Conta Cloudflare (5 minutos)

### Passo 1: Cadastro
1. Acesse: https://dash.cloudflare.com/sign-up
2. Use seu email profissional
3. Confirme o email

### Passo 2: Escolher Plano
- Escolha **Free Plan** (suficiente para começar)
- Workers inclusos: 100k requests/dia

---

## 2️⃣ Instalar Wrangler CLI (2 minutos)

```bash
# Já está no projeto, mas vamos garantir
cd worker/
npm install

# Atualizar wrangler para versão mais recente
npm install --save-dev wrangler@latest
```

### Login na Cloudflare (Ubuntu/Servidor sem GUI)

**Opção 1: Login via API Token (RECOMENDADO para servidores)**

1. Acesse: https://dash.cloudflare.com/profile/api-tokens
2. Click em "Create Token"
3. Use o template **"Edit Cloudflare Workers"**
4. Click em "Continue to summary" → "Create Token"
5. **Copie o token** (só aparece uma vez!)

No servidor:
```bash
cd worker/

# Configurar token
export CLOUDFLARE_API_TOKEN="seu-token-aqui"

# Ou criar arquivo .env
echo "CLOUDFLARE_API_TOKEN=seu-token-aqui" > .env

# Testar
npx wrangler whoami
```

**Opção 2: Login via Browser (se tiver acesso local)**

Se você estiver acessando via SSH, copie a URL que apareceu:
```
https://dash.cloudflare.com/oauth2/auth?response_type=code&client_id=...
```

1. Abra essa URL no seu computador local (não no servidor)
2. Autorize o acesso
3. Vai redirecionar para `http://localhost:8976/oauth/callback?code=...`
4. **Copie o parâmetro `code=` da URL**
5. No servidor, cole quando pedir

---

## 3️⃣ Configurar Worker (3 minutos)

### Passo 1: Configurar Backend URL

```bash
cd worker/

# Configurar secret (URL do backend)
npx wrangler secret put BACKEND_URL
# Quando pedir, digite: https://api-backend.platformengineer.io
```

### Passo 2: Deploy

```bash
# Deploy do worker
npx wrangler deploy

# Vai retornar algo como:
# Published cactus-worker (0.42 sec)
#   https://cactus-worker.SEU-USUARIO.workers.dev
```

**Anote essa URL!** É o endpoint público da sua API.

---

## 4️⃣ Testar Worker (2 minutos)

```bash
# Substitua pela URL que o wrangler retornou
WORKER_URL="https://cactus-worker.SEU-USUARIO.workers.dev"

# Teste 1: Health check
curl "$WORKER_URL/health"

# Teste 2: Autocomplete
curl "$WORKER_URL/api/autocomplete?q=tigre"

# Teste 3: Search
curl -X POST "$WORKER_URL/api/search" \
  -H "Content-Type: application/json" \
  -d '{"query": "tigre"}'

# Teste 4: Vector Search
curl -X POST "$WORKER_URL/api/vector-search" \
  -H "Content-Type: application/json" \
  -d '{"query": "jogos de tigre asiático", "k": 3}'
```

---

## 5️⃣ (Opcional) Domínio Customizado

Se você quiser usar `https://api.platformengineer.io` ao invés de `*.workers.dev`:

### Passo 1: Adicionar domínio na Cloudflare
1. Dashboard → Workers & Pages → cactus-worker
2. Settings → Triggers → Custom Domains
3. Add Custom Domain: `api.platformengineer.io`

### Passo 2: Cloudflare configura DNS automaticamente
- Cria registro CNAME apontando para o worker
- Provisiona certificado SSL automaticamente

---

## 6️⃣ Atualizar Frontend (1 minuto)

Edite `demo-frontend.html` para usar a URL do worker:

```javascript
// Linha ~15
const API_BASE_URL = 'https://cactus-worker.SEU-USUARIO.workers.dev';
```

Ou se configurou domínio customizado:

```javascript
const API_BASE_URL = 'https://api.platformengineer.io';
```

---

## 📊 Monitoramento

### Ver logs em tempo real:
```bash
cd worker/
npx wrangler tail
```

### Ver métricas no dashboard:
1. https://dash.cloudflare.com
2. Workers & Pages → cactus-worker
3. Metrics → Requests, Errors, CPU time

---

## 🔧 Troubleshooting

### Erro: "BACKEND_URL is not defined"
```bash
cd worker/
npx wrangler secret put BACKEND_URL
# Digite: https://api-backend.platformengineer.io
npx wrangler deploy
```

### Erro: "Not authorized"
```bash
npx wrangler login
# Autorize no browser
```

### Worker não atualiza
```bash
# Force deploy
npx wrangler deploy --force
```

---

---

## 7️⃣ Deploy do Frontend (Cloudflare Pages)

Agora que o Worker está funcionando, vamos publicar o frontend!

### Opção A: Cloudflare Pages (RECOMENDADO) ⭐

**Vantagens:**
- ✅ Grátis e ilimitado
- ✅ CDN global (300+ datacenters)
- ✅ HTTPS automático
- ✅ Deploy em 30 segundos

```bash
cd ~/cactus-gaming-search/

# O frontend já está na pasta frontend/ com a URL correta

# Deploy (passa a PASTA, não o arquivo)
npx wrangler pages deploy frontend --project-name=cactus-demo

# Vai retornar:
# ✨ Deployment complete!
#    https://XXXXXXXX.cactus-demo.pages.dev
```

**Pronto!** Seu frontend está no ar em `https://cactus-demo.pages.dev` 🎉

### Opção B: Ubuntu com Nginx

Se preferir hospedar no mesmo servidor:

```bash
# Criar pasta
sudo mkdir -p /var/www/cactus-frontend

# Copiar e atualizar arquivo
sudo cp demo-frontend.html /var/www/cactus-frontend/index.html
sudo sed -i 's|http://localhost:3000|https://cactus-worker.platformengineer.workers.dev|g' /var/www/cactus-frontend/index.html

# Configurar Nginx
sudo nano /etc/nginx/sites-available/cactus-frontend
```

Adicione:
```nginx
server {
    listen 80;
    server_name demo.platformengineer.io;

    root /var/www/cactus-frontend;
    index index.html;

    location / {
        try_files $uri $uri/ =404;
    }
}
```

```bash
# Ativar
sudo ln -s /etc/nginx/sites-available/cactus-frontend /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# SSL
sudo certbot --nginx -d demo.platformengineer.io
```

---

## ✅ Checklist Final

- [ ] Conta Cloudflare criada
- [ ] `wrangler login` executado
- [ ] `BACKEND_URL` configurado como secret
- [ ] `wrangler deploy` executado com sucesso
- [ ] Testes nos 4 endpoints passando
- [ ] Frontend deployado (Pages ou Nginx)
- [ ] (Opcional) Domínio customizado configurado

---

## 🚀 Próximos Passos

Depois que tudo estiver funcionando:

1. **Testar de diferentes locais** - Use https://tools.keycdn.com/performance para testar latência global
2. **Configurar rate limiting** (se necessário)
3. **Adicionar analytics** (Cloudflare Analytics é grátis)
4. **Integrar com seu frontend real**
5. **Configurar domínio customizado** (api.platformengineer.io)

---

## 💰 Custos

**Cloudflare Worker (Free Plan):**
- 100k requests/dia: **GRÁTIS**
- Acima disso: $0.50 por milhão de requests

**Estimativa:**
- 1M requests/mês = **GRÁTIS** (33k/dia)
- 10M requests/mês = ~$5/mês
- 100M requests/mês = ~$50/mês

**Muito mais barato que API Gateway + Lambda!**

