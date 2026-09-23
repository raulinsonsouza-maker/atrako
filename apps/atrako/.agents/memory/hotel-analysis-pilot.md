---
name: Conta Hotel analysis pilot
description: Product, privacy, and rollout boundaries for the Conta Hotel comparison and conversational analyst pilot.
---

The conversational analyst is named InPilot. Keep InPilot and the comparison experience limited to the exact Conta Hotel client, internal administrators, and development until explicitly approved. The UI remains hidden in portal mode, and production must return the feature as unavailable. The OpenAI model stays server-side and receives the user’s literal question only after PII validation, plus aggregate outputs from closed, tenant-scoped tools. Structured intent selects sources but must never replace the question.

Resolve Google Ads and CRM availability from actual account records before planning. Sources with no records stay out of the plan and model data context; when records exist, include their aggregate context on every analysis.

Creative analysis must match the dashboard: prefer synchronized Meta creative rows, but fall back to the same live Meta ads query used by the UI when the selected period has no persisted creative rows.

**Why:** The team wants to evaluate usefulness, answer quality, cost, and privacy before a broader rollout. Replacing wording with a controlled paraphrase repeatedly destroyed the user’s meaning; reject PII instead of silently changing an accepted question.

**How to apply:** Preserve the exact-client and environment gates, per-browser actor isolation, aggregate-only tools, and PII rejection boundary. Persist and send accepted questions literally. Any broader rollout requires a separate security and data-quality review.

Insight quality must not depend on prompt wording alone. Constrain the evidence passed to the final reviewer by the client’s business objective and by the exact ranking semantics; zero-spend attributed activity is not valid evidence of free acquisition.

**Why:** Repeated prompt-only revisions still produced plausible but unsupported claims, mixed lead and purchase economics, and treated delayed attribution as zero-cost efficiency.

**How to apply:** Conta Hotel is a sales account: default to purchases, CPA, attributed revenue, and ROAS, not leads or CPL. Resolve equivalent sales labels consistently and let strong purchase-plus-revenue evidence detect a stale lead classification. Only call a campaign “best” for the metric actually ranked, and use an objective-aware editorial pass before display.

Question interpretation uses OpenAI structured planning with the literal question and recent context. OpenAI then chooses among closed tools dynamically; the server validates tool relevance, caps/deduplicates calls, fixes metric semantics, and enforces tenant/period scope.

**Why:** Handwritten routing felt rigid and misunderstood language, while unconstrained tool choice over-queried unrelated sources and produced unsupported conclusions. Dynamic selection plus server guardrails preserves reasoning without unrestricted data access.

**How to apply:** Send accepted literal question and safe context to the planner, validate intent/dates, let the model call relevant closed tools, then reject calls outside the validated topics. Never replace the literal question with the plan.

The planner, analyst, and editor must share one explicit operating context that defines the agent's role, the data catalog, metric semantics, cross-source reasoning rules, and unavailable data. Broad account reviews may use all six closed queries; visual page filters must not limit the chat.

**Why:** A capable model still gives generic or misleading answers when it knows response rules but not what each dataset represents. Meta attribution, Google conversion value, CRM pipeline value, and Analytics traffic are complementary signals, not interchangeable revenue.

**How to apply:** Keep the shared context synchronized with the actual tools. State the effective account objective and exact periods dynamically. Add a capability to the context only after a tenant-scoped aggregate tool can provide it safely.

Plural campaign questions such as “quais campanhas venderam?” must be planned as an objective list of every campaign with the requested result above zero, not as a top-one ranking or an executive analysis.

**Why:** A ranked subset caused a factually incomplete answer that named only one of three campaigns with purchases and then invented recommendations the user did not request.

**How to apply:** Use the closed list-all-results action, filter to positive requested results, and suppress recommendations unless explicitly requested. Never slice serialized JSON: preserve complete small payloads; compact large lists into valid JSON with returned/total/omitted counts so partial coverage is explicit.

The analyst chat period is independent from the dashboard’s visual date filter. Temporal wording in the question defines the analysis window; without it, tools may use the account’s full available history and select relevant comparisons.

**Why:** Binding chat questions to the visible dashboard filter made valid strategic questions artificially narrow and prevented the analyst from using historical context.

**How to apply:** Treat the page filter as chart state only. Resolve common relative periods in São Paulo time, preserve them in the protected intent, and query tenant-scoped aggregate history when no period is requested.

Retries must reuse the validated structured intent and the original absolute start/end dates instead of planning the same wording again.

**Why:** Relative wording such as “ontem” changes meaning across calendar days, and context-dependent follow-ups can be interpreted differently after an error.

**How to apply:** Persist a protected retry token plus resolved absolute dates with recoverable errors. The UI must return all three fields, and the server must validate and execute them without another planning call.