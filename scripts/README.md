# 🚀 Scripts de Deploy

Scripts para deploy e manutenção do Cactus Gaming Search.

## 📜 Scripts Disponíveis

### `deploy_frontend.sh`
Deploy rápido apenas do frontend no Cloudflare Pages.

**Uso:**
```bash
./scripts/deploy_frontend.sh
```

**Tempo:** ~30 segundos

**O que faz:**
- Faz build do frontend
- Deploy no Cloudflare Pages
- Atualiza a URL principal

---

### `deploy_full_reset.sh`
Deploy completo com reset do Redis e reindexação.

**Uso:**
```bash
./scripts/deploy_full_reset.sh
```

**Tempo:** ~3-5 minutos

**O que faz:**
1. Build do backend localmente
2. Push do código para GitHub
3. Pull no servidor
4. Limpa o Redis (drop index + flush games)
5. Seed com novos dados (gera embeddings)
6. Rebuild do backend no servidor
7. Restart do PM2
8. Deploy do frontend

**⚠️ Atenção:** Este script apaga todos os dados do Redis e reindexia tudo!

---

### `test-api.sh`
Testa os endpoints da API.

**Uso:**
```bash
./scripts/test-api.sh
```

**O que faz:**
- Testa endpoint de busca
- Testa endpoint de autocomplete
- Testa endpoint de health check

---

## 🔧 Configuração

### Variáveis de Ambiente

Os scripts usam as seguintes variáveis:

- `CLOUDFLARE_API_TOKEN` - Token da API do Cloudflare (já configurado nos scripts)
- `SSH_KEY` - Chave SSH para acesso ao servidor (já configurado)
- `SERVER_IP` - IP do servidor EC2 (18.212.93.54)

### Permissões

Dê permissão de execução aos scripts:

```bash
chmod +x scripts/*.sh
```

---

## 📊 Quando Usar Cada Script

| Cenário | Script | Motivo |
|---------|--------|--------|
| Mudança apenas no frontend (HTML/CSS/JS) | `deploy_frontend.sh` | Mais rápido, não mexe no backend |
| Mudança no backend (TypeScript) | `deploy_full_reset.sh` | Precisa rebuild e restart |
| Mudança nos dados (games_data.json) | `deploy_full_reset.sh` | Precisa reindexar o Redis |
| Testar a API | `test-api.sh` | Verifica se tudo está funcionando |

---

## 🐛 Troubleshooting

### Script trava no seed
- **Causa:** Gerando embeddings para muitos jogos (chamada à OpenAI API)
- **Solução:** Aguarde 3-5 minutos, é normal

### Erro de permissão SSH
- **Causa:** Chave SSH sem permissão correta
- **Solução:** `chmod 400 ~/.ssh/gabs-se-sales-ssh-keypair.pem`

### Frontend não atualiza
- **Causa:** Cache do browser
- **Solução:** Hard refresh (Cmd+Shift+R ou Ctrl+Shift+R)

---

## 📝 Logs

Os logs do backend ficam em:
- `/root/cactus-gaming-search/backend/logs/out-0.log`
- `/root/cactus-gaming-search/backend/logs/err-0.log`

Para ver os logs:
```bash
ssh -i ~/.ssh/gabs-se-sales-ssh-keypair.pem ubuntu@18.212.93.54 "sudo pm2 logs cactus-backend"
```

