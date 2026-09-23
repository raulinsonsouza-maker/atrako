# Deploy na VPS Debian

Repositório: [github.com/raulinsonsouza-maker/central_v2](https://github.com/raulinsonsouza-maker/central_v2)

Stack: **Node 20 + PM2 + PostgreSQL + nginx**

## Convivência com outros serviços

Esta VPS **já pode ter outros apps rodando**. O deploy da Central foi pensado para **não parar nada**:

| Recurso | O que fazer |
|---------|-------------|
| **Outros sites nginx** | Só **adicionar** um novo arquivo em `sites-available` e dar `nginx -t && systemctl reload nginx` — **nunca** `restart` no nginx |
| **Porta 5000 ocupada** | Defina `PORT=5001` (ou outra livre) no `.env` antes do PM2 |
| **Porta 5432 ocupada** | Opção A: usar o Postgres **já existente** (criar DB `inout_central`). Opção B: Docker em outra porta (`POSTGRES_HOST_PORT=5433`) |
| **Docker / PM2 / nginx já instalados** | **Não reinstale** nem rode `systemctl enable --now` de novo — use o que já existe |
| **Firewall (ufw)** | **Não** rode `ufw enable` se já estiver ativo — só adicione regras se faltar algo |
| **apt upgrade** | Evite upgrade em massa na VPS de produção (pode reiniciar serviços de outros projetos) |
| **PM2** | Só gerencia o processo `central-inout` — **não** use `pm2 kill`, `pm2 delete all` nem reinicie outros apps |

### Verificar portas antes de subir

```bash
ss -tlnp | grep -E ':5000|:5432|:5433'   # ou a porta que for usar
pm2 list                                  # outros processos PM2 permanecem intactos
docker ps                                 # outros containers permanecem intactos
```

---

## 1. Dependências (só o que faltar)

Instale **apenas** pacotes ausentes — não pare serviços existentes:

```bash
# Exemplos (rode só o que der "command not found")
which git node npm pm2 docker nginx certbot
```

Se faltar Node 20:

```bash
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
sudo npm install -g pm2
```

---

## 2. Clonar o projeto

```bash
sudo mkdir -p /var/www/central-inout
sudo chown $USER:$USER /var/www/central-inout
git clone https://github.com/raulinsonsouza-maker/central_v2.git /var/www/central-inout
cd /var/www/central-inout
```

---

## 3. Banco de dados

### Opção A — Postgres já roda na VPS (recomendado se 5432 ocupada)

Crie só um banco novo; **não pare** o Postgres existente:

```bash
sudo -u postgres psql -c "CREATE DATABASE inout_central;"
sudo -u postgres psql -c "CREATE USER central_app WITH PASSWORD 'SENHA_FORTE';"
sudo -u postgres psql -c "GRANT ALL PRIVILEGES ON DATABASE inout_central TO central_app;"
```

No `.env`:

```env
DATABASE_URL="postgresql://central_app:SENHA_FORTE@127.0.0.1:5432/inout_central?schema=public"
```

### Opção B — Postgres dedicado via Docker (porta alternativa)

Se 5432 já está em uso, use outra porta no **host**:

```bash
# .env
POSTGRES_HOST_PORT=5433
DATABASE_URL="postgresql://postgres:SENHA_FORTE@127.0.0.1:5433/inout_central?schema=public"
```

```bash
docker compose up -d   # sobe só o container inout_central_db
```

Troque a senha padrão `admin` em produção.

---

## 4. Variáveis de ambiente

```bash
cp .env.example .env
nano .env
```

Mínimo em produção:

```env
NODE_ENV=production
PORT=5000
DATABASE_URL="postgresql://..."
ADMIN_SECRET="token-forte-admin"
SYNC_CRON_TOKEN="token-forte-sync"
```

Se a porta **5000** já estiver em uso por outro app:

```env
PORT=5001
```

Ajuste também o `upstream` no nginx (ex.: `127.0.0.1:5001`).

Credenciais de API podem ficar no banco (Admin > Integrações) ou no `.env`.

Logos: sem `BLOB_READ_WRITE_TOKEN`, arquivos vão para `public/logos/`.

---

## 5. Primeiro deploy

```bash
chmod +x scripts/deploy-vps.sh
./scripts/deploy-vps.sh
```

O script **só reinicia** o PM2 `central-inout` (ou cria se não existir). Outros processos PM2 não são tocados.

Na primeira vez, se o PM2 ainda não estiver configurado para boot:

```bash
pm2 startup   # executar o comando que o PM2 imprimir (com sudo)
pm2 save
```

### Build falhou com "heap out of memory"

VPS com pouca RAM pode falhar no `next build`. O script já usa `NODE_OPTIONS=--max-old-space-size=4096`. Se ainda falhar:

```bash
free -h   # ver RAM disponível
```

**Opção A — build com mais memória (se a VPS tiver ~2GB+ RAM ou swap):**

```bash
cd /var/www/central-inout
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

**Opção B — adicionar swap temporário (2GB) sem reiniciar outros serviços:**

```bash
sudo fallocate -l 2G /swapfile
sudo chmod 600 /swapfile
sudo mkswap /swapfile
sudo swapon /swapfile
free -h
cd /var/www/central-inout
export NODE_OPTIONS="--max-old-space-size=4096"
npm run build
pm2 start ecosystem.config.cjs
pm2 save
```

---

## 6. nginx + HTTPS (sem afetar outros sites)

**Adicione** um site novo — não edite configs de outros projetos:

```bash
sudo cp deploy/nginx-central.conf.example /etc/nginx/sites-available/central-inout
sudo nano /etc/nginx/sites-available/central-inout
# Ajuste server_name e a porta no upstream (PORT do .env)
sudo ln -sf /etc/nginx/sites-available/central-inout /etc/nginx/sites-enabled/
sudo nginx -t && sudo systemctl reload nginx
sudo certbot --nginx -d seu-dominio.com.br
```

Use **`reload`**, nunca **`restart`**, para não derrubar conexões de outros sites.

---

## 7. Sync diário (cron)

```bash
cd /var/www/central-inout
chmod +x scripts/cron-sync-vps.sh
./scripts/cron-sync-vps.sh          # teste
tail -50 /var/log/central-sync.log
crontab -e                          # adicionar linha abaixo
```

```cron
0 8 * * * /var/www/central-inout/scripts/cron-sync-vps.sh
```

Detalhes: [sync-cron.md](./sync-cron.md).

---

## 8. Atualizações

### Deploy rápido (recomendado — build no PC, ~3–5 min)

Na VPS com pouca RAM, **não** rode `npm run build` no servidor. Use o script que compila no seu PC e envia só a pasta `.next`.

**Uma vez (no PC):**

```powershell
cd C:\Users\Raulinson\Desktop\atualizado\Central
copy deploy\vps.env.example deploy\vps.local.env
# Ajuste deploy\vps.local.env se necessário (já vem com 191.252.109.144)
```

Configure **SSH por chave** (sem digitar senha a cada deploy):

```powershell
ssh-keygen -t ed25519
ssh-copy-id root@191.252.109.144
```

**Cada atualização (um comando):**

```powershell
npm run deploy:vps
```

O script faz: `npm run build` → envia `.next` → `pm2 restart central-inout`.

**Opções:**

```powershell
npm run deploy:vps -- -GitPull          # git pull na VPS antes
npm run deploy:vps -- -Migrate          # prisma migrate deploy na VPS
npm run deploy:vps -- -SkipBuild        # só reenvia .next (se já buildou)
npm run deploy:vps -- -GitPull -Migrate # código + migração de banco
```

Fluxo típico com mudanças no GitHub:

```powershell
git push central-v2 main
npm run deploy:vps -- -GitPull
```

### Deploy completo na VPS (lento, ~30 min)

Só use se não tiver como buildar no PC:

```bash
ssh root@191.252.109.144
cd /var/www/central-inout
git pull
./scripts/deploy-vps.sh
```

---

## 9. Migrar dados do Replit (opcional)

```bash
# No Replit: pg_dump ...
docker exec -i inout_central_db psql -U postgres -d inout_central < backup.sql
# ou, com Postgres nativo:
psql "$DATABASE_URL" < backup.sql
cd /var/www/central-inout && npx prisma migrate deploy
```

---

## Checklist pós-deploy

- [ ] `ss -tlnp | grep :PORT` — app ouvindo na porta escolhida
- [ ] `pm2 status central-inout` — só este processo novo/reiniciado
- [ ] Outros sites/serviços da VPS continuam no ar
- [ ] `curl -I https://seu-dominio/clientes` — HTTP 200
- [ ] Admin acessível com `ADMIN_SECRET`
- [ ] `npm run sync:daily` — teste manual do sync
