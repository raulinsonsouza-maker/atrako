# Configuração e primeiro uso

## 1. Variáveis de ambiente

Copie `.env.example` para `.env` e preencha:

- **DATABASE_URL**: conexão via PgBouncer (ex. `postgresql://user:pass@127.0.0.1:6432/crm`)
- **DIRECT_URL**: Postgres direto para migrations (`postgresql://user:pass@127.0.0.1:5432/crm`)
- **REDIS_URL**: `redis://127.0.0.1:6379`
- **BETTER_AUTH_SECRET**: string longa e aleatória
- **BETTER_AUTH_URL** / **NEXT_PUBLIC_APP_URL**: URL do app (ex. `http://localhost:3000`)
- **Stripe** (para billing): `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_*`
- **ENCRYPTION_KEY**: 32 bytes em hex (para credenciais de integração)

## 2. Banco e migrações

```bash
npx prisma generate
npx prisma migrate deploy
```

**Após alterar o schema ou rodar migrações:** pare o `npm run dev` (Ctrl+C), execute `npx prisma generate` e inicie de novo com `npm run dev`.

## 3. Primeiro SUPER_ADMIN

**Atalho (admin@admin.com / admin):**

```bash
npm run create-admin
```

**Personalizado:**

```bash
EMAIL=admin@seusite.com PASSWORD="suaSenhaSegura" NAME="Admin" npx tsx scripts/create-super-admin.ts
```

Depois, faça login em `/auth/login` e você será redirecionado para `/super-admin` (SUPER_ADMIN) ou `/dashboard` (tenant).

## 4. Fluxo típico

1. **Super Admin** em `/super-admin/tenants`: criar tenant (nome, slug, opcionalmente e-mail do admin).
2. Se informou e-mail: envie o link de convite gerado para a pessoa aceitar em `/auth/accept-invite?token=...`.
3. **Tenant Admin** (após aceitar convite): acessa `/dashboard`, configura WhatsApp em Configurações, campanhas (Meta/Google), assinatura em Assinatura.
4. **Tenant User**: leads, pipeline, atendimento.

## 5. Rodar o app

```bash
npm run dev          # desenvolvimento
npm run build && npm run start   # produção
npm run worker       # worker BullMQ (opcional; Redis obrigatório)
```

### Build em VPS com pouca RAM

Se o build travar ou falhar com `JavaScript heap out of memory`:

**Solução recomendada: build no seu PC e envie para a VPS**

Veja o passo a passo em [deploy/DEPLOY-VPS.md](deploy/DEPLOY-VPS.md). Resumo:
1. No PC: `npm run build`
2. Envie a pasta `.next` e arquivos do projeto para a VPS (WinSCP, scp ou `./deploy/sync-to-vps.sh`)
3. Na VPS: `npm ci --omit=dev` + `npx prisma generate` + `pm2 restart all`

**Alternativa:** adicionar swap e tentar `npm run build:vps` na VPS:

```bash
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile && sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
npm run build:vps
```

## 6. Webhooks

- **Stripe**: aponte o webhook do Stripe para `https://seu-dominio/api/webhooks/stripe` (eventos: `checkout.session.completed`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`).
- **Evolution API (WhatsApp)**: webhook em `/api/webhooks/whatsapp`.
- **Z-API (WhatsApp)**: configure no painel Z-API o webhook "Ao receber" para `https://seu-dominio/api/webhooks/zapi`. A Z-API exige HTTPS.
