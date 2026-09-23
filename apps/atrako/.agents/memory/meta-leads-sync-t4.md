---
name: Meta leads sync T4 per-ad fallback
description: /{form_id}/leads requires Page access token; /{ad_id}/leads works without it — T4 tier in metaLeadsSync.ts uses this as fallback
---

## Rule
When `/{form_id}/leads` returns error 100 ("missing permissions"), use `/{ad_id}/leads` instead.
This endpoint works with only `ads_read` + `leads_retrieval` — no Page token or `pages_read_engagement` needed.

**Why:** Meta Business Manager often doesn't assign System Users to Pages, breaking all form-level lead endpoints. But the ad-level endpoint bypasses the Page ownership check. Confirmed working for Incorporadora (account 1198843318594099) June 2026.

**How to apply:**
- `fetchLeadsFromAd(adId, token)` exported from `lib/meta/metaClient.ts`
- T4 block in `lib/sync/metaLeadsSync.ts`: kicks in when `leadsProcessed === 0` after T1/T2/T3
- T4 first tries to list all ads via `/act_{id}/ads` (rate-limit safe with try/catch), then supplements with known adIds from `MetaLeadIndividual`
- `/{ad_id}/leads` returns full campaign hierarchy (campaign_id, campaign_name, adset_id, adset_name, form_id) — same as form endpoint
- Non-lead-gen ads return error 100 silently (expected, not a real error)

## When form sync broke for Incorporadora
- T3 scanned 64 ads via `adcreatives{leadgen_id}` — returned 0 form IDs because `leadgen_id` field requires Page token too
- Fallback to known form IDs from MetaLeadIndividual — all error 100 (old forms expired/archived + new form `1462674255900535` not in DB yet)
- New form "FORM Atualizado - Condicional 28/05" (ID 1462674255900535) created May 28 — not in old MetaLeadIndividual
- Fix: T4 per-ad sync fetched 178 leads from 20 lead-gen ads, including 9 June leads with full attribution
