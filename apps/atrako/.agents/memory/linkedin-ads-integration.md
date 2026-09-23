---
name: LinkedIn Ads integration conventions
description: LinkedIn Marketing API usage patterns and OAuth design in this project
---

- LinkedIn Marketing API: base `https://api.linkedin.com/rest`, requires headers `LinkedIn-Version: 202606` (versions sunset after ~1 year — stale version returns 426 NONEXISTENT_VERSION; bump yearly) and `X-Restli-Protocol-Version: 2.0.0`. Scopes: `r_ads`, `r_ads_reporting`.
- App creds come from `LINKEDIN_CLIENT_ID`/`LINKEDIN_CLIENT_SECRET` secrets; without them every LinkedIn stage skips gracefully ("sem credenciais"). Per-connection OAuth tokens live in `ConexaoIntegracao` (access + refresh, auto-refresh 5-min margin).
- OAuth `state` is HMAC-signed (`conexaoId.exp.hmac` with SESSION_SECRET, 10-min TTL) — never pass raw ids or admin tokens in URLs. Start endpoint is a POST with `x-admin-token` header returning `{ authUrl }`; the callback validates state only.
- **Why:** architect review failed the first pass for CSRF-able state and admin token leaked via query string. Keep this pattern for any future OAuth provider.
- Leads = `oneClickLeads` from adAnalytics (no per-lead Lead Gen Form collection). Canal value in `FatoMidiaDiario` is `"LINKEDIN"`, which flows into "geral" automatically. Pace/saldo features are Meta/Google-only by design.
