---
name: Telegram daily summaries
description: How the Telegram daily-summary feature works — date math, parse mode, and sync lock fix.
---

## Architecture
- `lib/telegram/buildClientSummary.ts` — queries yesterday's FatoMidiaDiario (META + GOOGLE), compares vs. day-before, applies rule-based alerts, returns HTML string.
- `lib/telegram/sendTelegramMessage.ts` — POST to Telegram Bot API with `parse_mode: "HTML"`.
- `lib/telegram/sendTelegramSummaries.ts` — iterates `Cliente` where `ativo=true AND telegramAtivo=true`, sends sequentially with 500ms delay.
- `scripts/daily-sync.ts` — calls `sendTelegramSummaries()` after `runDailySync()` finishes.

## Date math
BRT = UTC-3. To get "yesterday" as stored in DB (midnight UTC):
```ts
function dateInBRT(offsetDays: number): Date {
  const brtNow = new Date(Date.now() - 3 * 60 * 60 * 1000);
  return new Date(Date.UTC(brtNow.getUTCFullYear(), brtNow.getUTCMonth(), brtNow.getUTCDate() + offsetDays, 0,0,0,0));
}
```

## Staleness check
If `lastFatoDate < todayBRT - 2 days`, send a warning message instead of data.

## Parse mode
Use `parse_mode: "HTML"` (not MarkdownV2). MarkdownV2 requires escaping every `.`, `-`, `(`, etc. which makes dynamic strings error-prone.

## Sync lock fix
`ATTEMPT_LOCK_MS` changed from 30min → 6min in `app/api/sync/daily-global/route.ts`. The 30min lock was too long — if the sync failed midway, the system would block re-attempts for 30 minutes.

## Config storage
`TELEGRAM_BOT_TOKEN` → key `telegram_bot_token` in `SystemConfig`.
`TELEGRAM_CHANNEL_ID` → key `telegram_channel_id` in `SystemConfig`.
Both are managed via `lib/config/integrations.ts` + admin UI at `/admin/configuracoes`.

## Per-client toggle
`telegramAtivo Boolean @default(false)` on `Cliente` model. Toggle in admin clientes edit form. Test button per client calls `POST /api/admin/clientes/[id]/telegram-test`.

**Why:** Per-client toggle allows rolling out summaries one client at a time rather than all-or-nothing.
