---
name: Daily sync scheduling in production
description: How the daily sync is triggered in prod — external cron + viewer trigger, and the pitfalls found in July 2026 logs.
---

## Current setup
- Production trigger: external scheduler (cron-job.org) sends `POST https://central-inout.replit.app/api/sync/daily-global` daily (user setting it to 05:00 America/Sao_Paulo). Viewer-triggered fire on admin panel open remains as backup.
- A Scheduled Deployment is NOT possible here: legacy single-deployment repl — changing the deployment type in Publishing settings would replace the autoscale web app.
- cron-job.org must use request method **POST** (GET returns 405); its ~30s response timeout makes a real run show as "failed" while the sync keeps running server-side — expected, ignore.

## Pitfalls diagnosed from prod SyncLog (July 2026) — now fixed
- Rolling 20h window from last successAt made the eligible time drift later every day → replaced with calendar-day (BRT) comparison in `app/api/sync/daily-global/route.ts`.
- Full sync takes 80–147 min; the old 6-min attempt lock allowed 4–6 concurrent runs/day, hammering APIs and killing Postgres connections → lock raised to 3h (must exceed real run duration).
- `sendTelegramSummaries()` lived only in the CLI script, never in `runDailySync()` → Telegram never sent in production. Moved into `runDailySync()` (single source; non-fatal on error).

**How to apply:** any new daily side-effect goes inside `runDailySync()`, and any once-a-day throttle must be calendar-day BRT, not a rolling window.
