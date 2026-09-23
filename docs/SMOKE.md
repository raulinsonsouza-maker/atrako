# Smoke checklist — Atrako SaaS único

1. `npm run dev` → http://localhost:5000
2. Login interno → sidebar: CRM, Social, Agenda, Commerce, Forms, Financeiro, Insights, Config
3. `/config/empresa` → salvar timezone/moeda
4. `/config/conexoes` → status MP/IG (conectar se env OK)
5. `/crm` → criar lead nativo
6. `/agenda/servicos` → criar serviço; `/b/[slug]` público
7. `/commerce` → produto; `/p/[slug]` e `/checkout/[id]`
8. Pagamento teste → ledger em `/finance`
9. `/onboarding` → wizard grava `onboardingStep` no Config
10. `docker compose up` sobe Postgres + web na 5000
