# Checklist operacional WhatsApp (Meta 2026) + Regicenter

## Plataforma (todo workspace)

- [ ] Método de pagamento no Meta Billing Hub (após 1.000 service msgs/mês a entrega para sem cartão)
- [ ] WABA / número com quality rating saudável
- [ ] Contas BR novas: preferir faturamento BRL quando elegível
- [ ] Templates Marketing com opt-in; tratar erro `131049` (não reenviar às cegas)

## Regicenter franquia

- [ ] Rodar `npx tsx apps/atrako/scripts/seed-regicenter-qualify.ts --slug=regicenter` (ou `--id=`)
- [ ] Confirmar forms: `/f/franquia-regicenter-lp` e `/f/franquia-regicenter-qualify`
- [ ] WhatsApp conectado em `/config/conexoes`
- [ ] Template Marketing M01 aprovado **sem** citar R$ no corpo (dinheiro só no fim do funil)
- [ ] `messagingPrefs.qualification.enabled = true` (o seed liga)
- [ ] Piloto: medir conclusão typeform/WA, % A/B/C, tempo até handoff

## Kill switch

Desligar: `WorkspaceSettings.messagingPrefs.qualification.enabled = false` — para o bot e a cadência sem deploy.
