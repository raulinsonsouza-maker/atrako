# Retirada gradual do Google Sheets

## Situação atual

O painel administrativo e o fluxo principal de sincronização já foram migrados para:

- `Conta` com `plataforma: "GOOGLE_ADS"`
- `Conta` com `plataforma: "META"`
- sincronização por API em vez de planilha

## O que continua legado temporariamente

- `SheetsConfig` no schema Prisma
- rotas de sync de Google Sheets
- utilitários de validação/importação de planilha
- configuração de credenciais de Google Sheets

## Estratégia de remoção

### Fase 1

- manter `SheetsConfig` apenas para compatibilidade com dados antigos
- não usar mais planilha para criar ou editar clientes
- não usar mais Google Sheets no `sync-all`
- priorizar `Conta` como fonte única dos IDs de mídia

### Fase 2

- remover `app/api/sync/google-sheets/route.ts`
- remover `lib/sync/googleSheetsSync.ts`
- remover `lib/google/sheetsClient.ts`
- remover `lib/admin/sheetsValidation.ts`
- remover `lib/admin/extractSpreadsheetId.ts`
- remover `lib/repositories/sheetsConfigRepository.ts`
- remover `app/api/admin/config/google-sheets/route.ts`
- remover `SheetsConfig` do `prisma/schema.prisma`
- limpar variáveis de ambiente de Google Sheets em `.env.example`

## Pré-requisitos para fase 2

- todos os clientes relevantes precisam ter conta Google Ads e/ou Meta cadastradas
- o script `npm run scripts:import-clientes-contas` precisa ter sido executado e revisado
- o sync diário precisa estar estável usando somente APIs
- não deve haver nenhuma tela consumindo `sheetsConfig` como fonte principal
