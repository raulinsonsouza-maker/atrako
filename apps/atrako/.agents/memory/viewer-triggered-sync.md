---
name: Viewer-triggered sync pattern
description: How to refresh per-entity data on page open without a cron, safely
---

When a daily cron can't run (see replit-deployment-constraint.md), refresh an
entity's data when someone opens its page, instead of on a schedule.

Pattern that avoids the obvious pitfalls (slow page, API hammering, dup runs):
- Fire the sync **in the background** (fire-and-forget `fetch` in a mount effect,
  guarded by a ref so it runs once per id). Never block render on it.
- Decide whether to actually run **server-side**, not client-side. Use an **atomic
  conditional claim**: `updateMany({ where: { id, OR:[lastSyncAt null, lastSyncAt <
  threshold] }, data: { lastSyncAt: now } })`. If `count===0`, skip. This both
  throttles (staleness window) and acts as a cross-instance lock on autoscale.
- Set the claim timestamp **before** running the sync. Tradeoff: a failed sync won't
  retry until the window passes — deliberate, prioritizes not hammering a failing
  upstream. A manual "refresh now" button bypasses the throttle (call without the
  background flag).
- Keep background errors silent (public/portal viewers shouldn't see error UI);
  surface errors only for the manual button.

**Limitations to call out to the user:** entities nobody opens never refresh, and
side-effects that aren't viewer-driven (e.g. daily alert emails) still need a real
scheduled job.

## Global "once-a-day on panel open" variant (covers all entities + alerts)
To also cover entities nobody opens AND run daily side-effects (alerts) without a
cron, add a *second* fire-and-forget trigger on panel mount (admin-only) that runs
the **full** daily job under a **global** atomic claim:
- Singleton lock row (a dedicated `SyncState` model, `id="global"`) with **two**
  timestamps, not one:
  - `successAt` → long window (e.g. 20h) = "already ran today, skip".
  - `attemptAt` → short window (e.g. 30min) = in-progress lock.
  Claim = `updateMany` where `(successAt null OR < dayAgo) AND (attemptAt null OR <
  lockAgo)` set `attemptAt=now`; `count===1` wins. Set `successAt=now` **only after
  success** (fatalCount===0). This fixes the single-timestamp flaw: a mid-run
  failure only blocks 30min, not the whole day.
- `await` the long job inside the route (browser fetch is fire-and-forget anyway) so
  the autoscale instance stays alive until done; set `maxDuration` high. If it still
  gets cut at the platform cap, idempotent/incremental sync self-heals next trigger.
- **Gate to admin only** (`!portalMode`) — a client opening their portal must not
  trigger a full-org sync + alert emails. Use a module-level `let fired=false` guard
  so it fires once per tab session, not per entity switch.
- Extract the orchestration into ONE shared lib fn (`runDailySync()`) used by both
  the CLI/scheduled script and this endpoint — avoids logic drift between them.

**Why over "sync ALL on every open":** triggering a full all-accounts sync on every
visit hammers upstream APIs and risks rate limits + concurrent runs. The global
once/day claim gives near-daily coverage at ~zero cost; the accepted tradeoff is it
only runs if someone opens the admin panel that day.
