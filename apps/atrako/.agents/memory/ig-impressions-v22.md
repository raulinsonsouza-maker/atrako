---
name: Instagram views replace impressions
description: Account-level impressions was removed in Graph API v22; use views and preserve unavailable data as null
---

# Instagram `views` metric — v22 replacement

## Rule
`impressions` was deprecated for account insights in Graph API v22 and removed for all versions after April 21, 2025. Use `views` with `metric_type: "total_value"` and parse `data[0].total_value.value`.

An empty `data` array means the metric is unavailable, not zero. Preserve existing stored values on sync failures and return null/“—” to the dashboard when no authoritative value exists.

**Why:** Meta’s current account-insights documentation explicitly lists the deprecation and says unavailable insights return an empty dataset instead of `0`. Treating empty responses as zero produced misleading production KPIs.

**How to apply:**
- Request `{ metric: "views", period: "day", since, until, metric_type: "total_value" }`.
- For periods split into multiple API windows, sum only additive metrics such as views and interactions; do not sum deduplicated reach across windows.
- Log per-metric errors, avoid overwriting valid DB values when a metric fails, and expose unavailable values as null.
- `website_clicks` with `metric_type=total_value` inflates beyond just bio link clicks (captures stories + post links) — do not use for "Cliques no perfil" KPI, as it will diverge ~7x from external platforms like mLabs
