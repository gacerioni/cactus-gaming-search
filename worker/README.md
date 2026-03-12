# ⚡ Cloudflare Worker - Edge Proxy

Cloudflare Worker que funciona como proxy/edge layer para o backend AWS.

## 🎯 Função

- ✅ **CORS** - Permite chamadas do frontend
- ✅ **Rate Limiting** - Proteção contra abuso
- ✅ **Proxy** - Encaminha requests para backend AWS
- ✅ **Edge Global** - 300+ datacenters Cloudflare

## 🚀 Deploy

### 1. Instalar Wrangler CLI

```bash
npm install -g wrangler
```

### 2. Login Cloudflare

```bash
wrangler login
```

Vai abrir navegador para autenticar.

### 3. Configurar Domínio no Cloudflare

**No GoDaddy:**
1. Ir em **DNS Management** para `platformengineer.io`
2. Trocar **Nameservers** para Cloudflare

**No Cloudflare Dashboard:**
1. Login: https://dash.cloudflare.com
2. **Add a Site** → `platformengineer.io`
3. Escolher plano **Free**
4. Copiar os 2 nameservers mostrados:
   ```
   ns1.cloudflare.com
   ns2.cloudflare.com
   ```
5. Colar no GoDaddy (passo anterior)
6. Aguardar ativação (5-30 min)

### 4. Instalar Dependências

```bash
cd worker/
npm install
```

### 5. Configurar Secret (Backend URL)

```bash
wrangler secret put BACKEND_URL
```

Quando pedir, digitar:
```
https://api-backend.platformengineer.io
```

### 6. Deploy Worker

```bash
wrangler deploy
```

Vai aparecer:
```
✅ Published cactus-worker
✅ https://cactus-worker.<SEU_SUBDOMAIN>.workers.dev
```

### 7. Adicionar Custom Domain

**No Cloudflare Dashboard:**
1. **Workers & Pages** → `cactus-worker`
2. **Settings** → **Triggers** → **Custom Domains**
3. **Add Custom Domain** → `worker.platformengineer.io`
4. Cloudflare configura DNS + SSL automaticamente!
5. Aguardar 1-2 minutos

### 8. Testar

```bash
# Autocomplete
curl "https://worker.platformengineer.io/api/autocomplete?q=tig"

# Search
curl -X POST https://worker.platformengineer.io/api/search \
  -H "Content-Type: application/json" \
  -d '{"query": "tigre"}'

# Vector Search
curl -X POST https://worker.platformengineer.io/api/vector-search \
  -H "Content-Type: application/json" \
  -d '{"query": "jogos de tigre asiático"}'
```

## 🔧 Manutenção

### Ver logs em tempo real

```bash
wrangler tail
```

### Atualizar código

```bash
wrangler deploy
```

### Ver secrets configurados

```bash
wrangler secret list
```

### Atualizar secret

```bash
wrangler secret put BACKEND_URL
```

## 📊 Estrutura

```
worker/
├── src/
│   └── index.ts       # Worker proxy
├── wrangler.toml      # Cloudflare config
├── package.json
└── README.md
```

## 🌍 Custom Domain

Depois de configurar, seu worker estará disponível em:

- ✅ `https://worker.platformengineer.io` (custom domain)
- ✅ `https://cactus-worker.<SEU_SUBDOMAIN>.workers.dev` (workers.dev)

## 🔒 HTTPS

Cloudflare gera certificado SSL **automaticamente** para custom domains!

Não precisa configurar nada, já vem pronto.

## 📈 Monitoramento

No Cloudflare Dashboard:
1. **Workers & Pages** → `cactus-worker`
2. **Metrics** - Ver requests, erros, latência
3. **Logs** - Ver logs em tempo real

## 💰 Custo

Cloudflare Workers Free Tier:
- ✅ 100.000 requests/dia GRÁTIS
- ✅ Depois: $0.50 por milhão de requests

Para demo, vai ser **100% grátis**!

