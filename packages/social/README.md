# @atrako/social

Pacote de integração do módulo Social (Instagram / ManyChat-like).

Código-fonte operacional: `apps/social-source` (ex-`central_v2`):

- `lib/instagram/automationEngine.ts`
- `lib/instagram/commentDmFlow.ts`
- modelos Prisma `Ig*`

Este pacote publica `social.comment_received` e `social.dm_sent` para o bridge do shell.
