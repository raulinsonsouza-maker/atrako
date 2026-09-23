---
name: CRM per-lead media attribution limits
description: Which channels can show real per-lead campaign/keyword in the CRM lead detail, and why Google cannot.
---

# Per-lead media attribution: what is real vs impossible

When asked to show "which campaign / adset / ad (Meta) and campaign / keyword (Google) a CRM lead came from", the constraint is the **data source**, not the UI.

- **Meta (Facebook/Instagram Ads): REAL and available.** Lead Ads form submissions are synced into `MetaLeadIndividual` (campaign/adset/ad/form + email/phone), then matched to `LeadCrm` by email→phone in `metaCrmMatcher`, writing `dadosMarketing.metaCampaignName/metaAdsetName/metaAdName/metaFormName`. The drawer shows these with a "✓ confirmado" badge.
- **Google: NOT available per-lead.** Confirmed against the CVCRM CVDW `leads` API docs (https://desenvolvedor.cvcrm.com.br/reference/leads-20.md) — it exposes only `origem/origem_nome/origem_ultimo`, `midia_original/midia_ultimo`, `conversao_original/conversao_ultimo`. There is **no gclid, no UTM, no keyword, no campaign** field. Google leads in practice are mostly organic ("Busca Orgânica"). There is no Google equivalent of `MetaLeadIndividual`, and Google Ads API cannot tie an individual person/lead to a keyword. `keyword_view`/`fetchKeywordMetrics` is **aggregate** keyword performance only (lives in the Criativos tab).
- **RD Station Marketing enrichment** (`lib/rdMarketing/enrich.ts`) does NOT fill campaign/keyword either — `normalizeEnrichment` extracts business-profile custom fields (faturamento, setor, cargo), not UTM/traffic. For the one CVCRM client it was also unconfigured (no token, 0/653 leads had `rdContactId`).

**Why this matters:** Do NOT fabricate Google per-lead campaign/keyword — the user explicitly requires real data. The honest UI is: show Meta confirmed data, and for channels without ad-level attribution show a note that per-lead campaign/keyword isn't tracked (only origem/mídia/conversão), pointing to the Criativos tab for Google keyword aggregates.

**How to apply:** If a future request asks to "bring Google campaign/keyword into the lead detail", the only way to make it real is to first capture gclid/UTM at lead-capture time and persist it into `LeadCrm.dadosCv` (CVCRM doesn't carry it today) — otherwise it's impossible.

## Meta hierarchy breakdown (campaign → adset → ad) in the CRM attribution tab

`dadosMarketing` carries the Meta **IDs as well as names** (`metaCampaignId/AdsetId/AdId/FormId`), not just the `*Name` fields. This is what makes a real, drill-down breakdown possible:
- Grouping leads into campaign→conjunto→anúncio is done by ID; outcome counts reuse the same bucket logic as the rest of the attribution route (leads/andamento=atendimento/visitou/ganhos/perdidos/valor/taxaGanho), so they stay consistent.
- Meta **spend per level** is joined separately from `MetaAdsCriativo` via `groupBy` on `campaignId`/`adsetId`/`adId` (CPL = spend ÷ leads). The lead JSON has no spend; never try to read spend off the lead.
- **Click-to-filter contract:** the lead list filter values are Meta **IDs** (not names). `buildLeadFilterWhere` maps filter types `metaCampaign`/`metaAdset`/`metaAd` to a Prisma JSON `path` equals on `dadosMarketing.metaCampaignId/metaAdsetId/metaAdId`. Filtering by name would break — always pass the ID.
- Only ~half of CVCRM leads have these Meta IDs (others are non-Meta or pre-matcher); null-ID nodes must render non-clickable to avoid emitting an empty-ID filter.

## Why Meta hierarchy goes stale for recent leads (form-sync Page-access gap)

If recent CRM leads from Meta show **no** campaign/conjunto/anúncio while older ones do, the cause is almost never the matcher and never the dashboard — it's that `MetaLeadIndividual` (the Meta form-leads table) stopped being filled. Diagnosis order that actually works:
1. Check `MAX("createdTime")` in `MetaLeadIndividual` for the client — if it's frozen at some past date while CRM keeps getting Meta leads, the form sync is broken from that date.
2. The form sync (`syncMetaLeadsCliente` → `fetchLeadGenForms`) needs the token to **discover and read the lead-gen forms**, which requires **Page-level access**, not just ad-account access. A Meta **SYSTEM_USER** token can have `ads_management`/`ads_read`/`leads_retrieval` (so spend/insights keep flowing and the dashboard looks healthy) yet still be **unable** to read forms because the system user isn't assigned to the client's Page (needs `pages_manage_ads`/`pages_read_engagement`).
   - Symptom chain in logs: `leadgen_forms` on the ad account → error 100 "nonexisting field"; promote_pages/campaigns/me-accounts → 0 pages; `/{pageId}?fields=access_token` → "(#100) ... requires pages_read_engagement"; `/{formId}/leads` with the user token → "(#200) Requires pages_manage_ads" or "(#100) ... does not exist". All of that = **Page access gap**, NOT token expiry and NOT missing `leads_retrieval`.
   - Verify the token quickly via `/me/permissions` + `/debug_token` (SYSTEM_USER tokens are long-lived/never-expire) before blaming expiry. The account's owning Page can be found via `/{act_id}?fields=business` then business `owned_pages`/`client_pages`, or via adcreatives `object_story_spec.page_id`.
   - **Fix is on the Meta side** (re-assign the system user to the Page with page permissions in Business Manager / reconnect a token that has them) — not solvable in code.

**Why:** Spend and form-leads are two different permission scopes; spend can look perfectly fine while form-lead attribution silently dies. Don't waste time on the matcher or token expiry.

### Bug fixed along the way: `effective_status` "DELETED" is rejected
The ads-scan fallback (Tier 3 of `fetchLeadGenForms`) used `effective_status=[...,"DELETED"]`. Meta now rejects `DELETED` in the ads `effective_status` filter with error 100 / subcode 1815001 ("Invalid parameter"), failing the whole request. Valid values that work: `ACTIVE`, `PAUSED`, `ARCHIVED`. Never put `DELETED` in an ads `effective_status` filter. When all discovery tiers return 0 forms, `syncMetaLeadsCliente` now returns a non-fatal `warning` (HTTP 200, not a hard error) so a Page-access gap is visible instead of looking like "0 new leads".
