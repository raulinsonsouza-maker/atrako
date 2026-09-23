---
name: Google Ads PMax attribution window
description: PMax campaigns use 30-day data-driven attribution; incremental sync must look back 30 days or conversions are understated by ~16%
---

# Google Ads PMax Attribution Window

## The Rule
Incremental sync lookback for Google Ads must be **30 days**, not 3 days.

**Why:** PMax campaigns use Google's data-driven attribution model with a 30-day click attribution window. A conversion today can be attributed retroactively to an ad click that happened up to 30 days ago. With a 3-day lookback, syncs on day D only see conversions attributed to days D-3 through D. Any conversion attributed to a click on D-4 or earlier (but converted after that sync ran) is permanently missed.

**Observed impact:** ~16.5% undercount in conversions and ~26% undercount in conversion value for Varella Motos (PMax-heavy account, June 2026). The `metrics.conversions` API field itself is correct — the issue is stale rows for older days that never get re-fetched.

**How to apply:**
- `lib/sync/googleAdsApiSync.ts` line ~98: `d.setDate(d.getDate() - 30)` (not -3)
- This makes every incremental sync re-process the last 30 days, capturing all late-attributed conversions via upsert
- Cost/impressions data doesn't have this issue (recorded immediately), but the upsert is safe for those fields too
- Accounts heavily using Shopping or Search (not PMax) benefit less but are also not harmed

**Trade-off:** Each incremental sync processes ~30 days × N campaigns rows instead of ~3 days. For typical accounts (5–10 campaigns) this is ~150–300 rows/sync, still well within API rate limits and DB performance.
