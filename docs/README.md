# 📚 Documentação - Cactus Gaming Search

Documentação completa do projeto Cactus Gaming Search.

## 📖 Documentos Disponíveis

### 🚀 [SETUP.md](./SETUP.md)
Guia de configuração inicial do projeto.

**Conteúdo:**
- Pré-requisitos
- Instalação local
- Configuração do Redis
- Configuração do OpenAI
- Primeiro deploy

**Quando usar:** Primeira vez configurando o projeto.

---

### 🎓 [TUTORIAL.md](./TUTORIAL.md)
Tutorial passo a passo de como usar o sistema.

**Conteúdo:**
- Como funciona a busca híbrida
- Como adicionar novos jogos
- Como testar a API
- Como fazer deploy

**Quando usar:** Aprender a usar o sistema.

---

### 📦 [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md)
Guia completo de deploy e manutenção.

**Conteúdo:**
- Deploy do backend (EC2)
- Deploy do frontend (Cloudflare Pages)
- Configuração do PM2
- Troubleshooting

**Quando usar:** Fazer deploy ou resolver problemas.

---

### ☁️ [CLOUDFLARE_SETUP.md](./CLOUDFLARE_SETUP.md)
Configuração específica do Cloudflare Pages.

**Conteúdo:**
- Criação do projeto no Cloudflare
- Configuração do token de API
- Deploy via Wrangler
- Custom domains

**Quando usar:** Configurar ou modificar o Cloudflare.

---

### 📝 [CHANGELOG_HASH_MIGRATION.md](./CHANGELOG_HASH_MIGRATION.md)
Histórico da migração de JSON para HASH no Redis.

**Conteúdo:**
- Motivos da migração
- Mudanças técnicas
- Impacto na performance
- Lições aprendidas

**Quando usar:** Entender a arquitetura do Redis.

---

### 📊 [DELIVERY_SUMMARY.txt](./DELIVERY_SUMMARY.txt)
Resumo executivo do projeto entregue.

**Conteúdo:**
- Features implementadas
- Tecnologias utilizadas
- Métricas de performance
- Próximos passos

**Quando usar:** Apresentação executiva do projeto.

---

## 🗂️ Estrutura de Documentação

```
docs/
├── README.md                      # Este arquivo
├── SETUP.md                       # Setup inicial
├── TUTORIAL.md                    # Tutorial de uso
├── DEPLOY_GUIDE.md                # Guia de deploy
├── CLOUDFLARE_SETUP.md            # Setup do Cloudflare
├── CHANGELOG_HASH_MIGRATION.md    # Histórico de migração
└── DELIVERY_SUMMARY.txt           # Resumo executivo
```

---

## 🔗 Links Úteis

- **Frontend:** https://128b1c88.cactus-demo.pages.dev
- **Backend API:** https://api-backend.platformengineer.io
- **GitHub:** https://github.com/gacerioni/cactus-gaming-search
- **Redis Cloud:** https://app.redislabs.com

---

## 📞 Suporte

Para dúvidas ou problemas:

1. Consulte a documentação relevante acima
2. Verifique os logs do servidor
3. Teste a API com `scripts/test-api.sh`
4. Verifique o status do PM2: `pm2 status`

---

## 🎯 Quick Start

**Novo no projeto?** Siga esta ordem:

1. 📖 Leia [SETUP.md](./SETUP.md) para configurar
2. 🎓 Leia [TUTORIAL.md](./TUTORIAL.md) para aprender
3. 🚀 Use [DEPLOY_GUIDE.md](./DEPLOY_GUIDE.md) para deployar

**Já conhece o projeto?** Use os scripts em `../scripts/`:

```bash
# Deploy rápido do frontend
./scripts/deploy_frontend.sh

# Deploy completo com reindexação
./scripts/deploy_full_reset.sh

# Testar a API
./scripts/test-api.sh
```

