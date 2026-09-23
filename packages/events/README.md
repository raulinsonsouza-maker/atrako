# @atrako/events

Contratos versionados para conectar os modulos do Atrako durante a migracao.

Os eventos carregam apenas contexto e dados necessarios para o consumidor. Nenhum modulo deve acessar diretamente as tabelas de outro modulo.

## Jornada inicial

`tracking.page_viewed` -> `tracking.form_submitted` -> `lead.created` -> `conversation.started` -> `booking.created` -> `payment.paid` -> `revenue.recorded`

## Regras

- Todo evento pertence a um `workspaceId`.
- Todo evento possui `idempotencyKey`.
- Consumidores devem ser idempotentes.
- A versao do contrato deve ser incrementada quando o formato mudar.
- Segredos e tokens de integracao nunca entram no payload.
