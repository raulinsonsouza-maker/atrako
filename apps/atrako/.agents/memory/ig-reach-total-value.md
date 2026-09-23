---
name: IG reach metric deduplication
description: Instagram reach must use metric_type=total_value; daily sum overcounts; follower_count limited to 30 days.
---

## Rule
For `reach` on Instagram Insights API, always use `metric_type=total_value` instead of summing `period=day` daily values.

**Why:** Daily sum counts the same person multiple times (once per day they appear). The platform shows deduplicated unique accounts per period. The discrepancy is 3× or more for viral content. With `metric_type=total_value`, the response is `data[0].total_value.value` (same format as `total_interactions` and `profile_views`).

**How to apply:** In both `lib/sync/syncInstagram.ts` and the live path of `app/api/clientes/[id]/social-media/route.ts`, the reach call is:
```
metric: "reach", period: "day", metric_type: "total_value", since, until
```
Extraction: `data[0].total_value.value`

## `follower_count` 30-day limitation
The `follower_count` metric only returns data for the last ~30 days. For months older than 30 days, the API returns empty and `novosSeguidores` would be written as 0, corrupting previously correct values.

**Fix:** In the upsert UPDATE (not CREATE), only update `novosSeguidores` when `hasFollowerData = true` (i.e. `isWithin30Days && followValues.length > 0`).

`InstagramInsightDiario` is only populated by `syncInstagramTodosClientes` (called from `runDailySync`). The per-client sync route (`syncClienteCanais`) does NOT call Instagram sync.
