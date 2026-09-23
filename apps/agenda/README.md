# Book Symbius

Produto **Symbius** de agendamento multi-tenant com checkout transparente **Cakto** (Pix + cartão) na última tela do funil.

## Stack

- Next.js (App Router) + TypeScript
- PostgreSQL-ready schema via Prisma (SQLite no desenvolvimento local)
- NextAuth (credentials)
- Cakto API + SDK
- Google Calendar (OAuth por organização)

## Como rodar

```bash
npm install
npx prisma migrate dev
npm run dev
```

Abra [http://localhost:3000](http://localhost:3000), crie uma conta e use a página de exemplo gerada no signup.

## Fluxo público

`/p/[slug]` → Serviço → Data/hora → Dados → Pagamento Cakto → Confirmação

## Configurar Cakto

1. Painel → **Configurações** → cole `client_id`, `client_secret` e Offer ID
2. Webhook: `POST /api/webhooks/cakto`

Sem credenciais, o checkout roda em **modo demo**.

## Google (login + Agenda)

1. No [Google Cloud Console](https://console.cloud.google.com/), ative **Google Calendar API**
2. Crie credenciais **OAuth 2.0** (aplicativo Web)
3. Em **Authorized redirect URIs**, cadastre **os dois** (mesmo Client ID):
   - Login NextAuth: `{NEXTAUTH_URL}/api/auth/callback/google`
   - Google Agenda: `{NEXTAUTH_URL}/api/google/callback`
   - Ex. produção: `https://book.symbius.com.br/api/auth/callback/google` e `https://book.symbius.com.br/api/google/callback`
   - Ex. local: `http://localhost:3000/api/auth/callback/google` e `http://localhost:3000/api/google/callback`
4. Cole `GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_SECRET` no `.env` e reinicie
5. Em **Configurações** → **Conectar Google Agenda**

Com a conta conectada:
- Reserva confirmada cria evento no Google
- Cancelamento remove o evento
- Free/busy do Google bloqueia horários no funil público

## Variáveis

Veja `.env.example`.
