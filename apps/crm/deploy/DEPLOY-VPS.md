# Deploy na VPS: build local (evita falta de RAM)

Se o `npm run build` falha na VPS por falta de memória, faça o build no seu PC e envie os arquivos.

## Passo a passo

### 1. No seu PC (Windows)

Abra o PowerShell na pasta do projeto:

```powershell
cd c:\Users\Raulinson\Desktop\crm

# Build (usa a RAM do seu PC)
npm run build
```

### 2. Enviar arquivos para a VPS

**Opção A – SCP (PowerShell, se tiver OpenSSH):**

```powershell
# Da pasta do projeto (c:\Users\Raulinson\Desktop\crm)
scp -r .next package.json package-lock.json next.config.mjs postcss.config.mjs tailwind.config.ts tsconfig.json next-env.d.ts public src prisma jobs deploy scripts root@191.252.178.138:/var/www/crm/
```

Se der erro com vários arquivos, envie em partes:
```powershell
scp -r .next root@191.252.178.138:/var/www/crm/
scp -r public src prisma jobs root@191.252.178.138:/var/www/crm/
scp package.json package-lock.json next.config.mjs postcss.config.mjs tailwind.config.ts tsconfig.json next-env.d.ts root@191.252.178.138:/var/www/crm/
```

**Opção B – WinSCP ou FileZilla (interface gráfica):**

1. Conectar em `191.252.178.138` (usuário root, sua senha)
2. Ir em `/var/www/crm`
3. Enviar:
   - pasta `.next` (inteira)
   - `package.json`, `package-lock.json`
   - `next.config.mjs`, `postcss.config.mjs`, `tailwind.config.ts`, `tsconfig.json`, `next-env.d.ts`
   - pastas `public`, `src`, `prisma`, `jobs`, `deploy`, `scripts`

**Opção C – Git Bash ou WSL (se tiver rsync):**

```bash
./deploy/sync-to-vps.sh root@191.252.178.138
```

### 3. Na VPS

```bash
cd /var/www/crm

# Instalar dependências (somente produção)
npm ci --omit=dev

# Gerar Prisma client
npx prisma generate

# Parar processos antigos e subir com ecosystem (usa porta 3001 para evitar conflito)
pm2 delete crm-app crm-worker 2>/dev/null || true
pm2 start ecosystem.config.js
pm2 save
pm2 startup   # na primeira vez
```

**Importante:** O `ecosystem.config.js` usa porta **3001** para evitar conflito com o prospectads (provavelmente na 3000). No Nginx, use `proxy_pass http://127.0.0.1:3001;` para o CRM.

---

## Diagnóstico: crm-app "Failed to start server"

1. **Conflito de porta** – outro app (ex: prospectads) usando 3000:
   ```bash
   sudo lsof -i :3000
   sudo lsof -i :3001
   ```
   O ecosystem.config.js já usa 3001. Atualize o Nginx.

2. **Rodar manualmente para ver o erro real:**
   ```bash
   cd /var/www/crm
   PORT=3001 npm run start
   ```
   Ou com o .env carregado:
   ```bash
   cd /var/www/crm && export $(grep -v '^#' .env | xargs) && PORT=3001 node node_modules/.bin/next start
   ```

3. **Conferir banco de dados:** `npx prisma migrate deploy` e testar conexão.

---

## Resumo

| Onde   | O que fazer                                      |
|--------|---------------------------------------------------|
| PC     | `npm run build`                                  |
| PC     | Enviar `.next` + arquivos do projeto para a VPS  |
| VPS    | `npm ci --omit=dev` + `prisma generate` + `pm2 restart` |

O `.next` vem pronto do PC; na VPS não é necessário rodar `npm run build`.
