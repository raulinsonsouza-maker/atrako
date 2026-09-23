---
name: CRM incremental sync leaves leads permanently sparse
description: Why CV CRM leads show empty attribution in one env but not another, and the full-resync fix
---

# CRM incremental sync vs. async attribution

CV CRM / RD Station fills in a lead's attribution (origem, mídia, conversão) **asynchronously, after** the lead is created. The CRM sync is incremental by default: it fetches only leads whose CV "data de referência" changed within `ultimoSyncAt − 3 days`, passed as `a_partir_data_referencia`.

**The trap:** a lead first synced right after creation (before attribution propagated) is stored with empty `dadosCv`. Once it falls outside the incremental window it is **never re-fetched**, so it stays permanently sparse and silently fails the AND-combined attribution filters (`/crm/atribuicao` route) → it disappears from CRM counts.

**Why it differs per environment:** dev and prod are separate DBs synced at different moments. Whichever env happened to do a full sync (or synced after CV finished attributing) has complete data; the other is stuck with whatever it captured early. Identical filter config + identical live CV API data can still produce different counts purely from this staleness. Don't chase the filters — check `dadosCv` for null `midiaOriginal` first.

**Fix / how to repair:** a **full** sync (`since=undefined`, no `a_partir_data_referencia`) re-fetches every lead and overwrites the sparse rows. The manual "Atualizar agora" button now triggers a full CRM re-sync (background/auto stays incremental). So to repair a prod env: deploy, then click "Atualizar agora" on the affected client (or POST the per-client sync without `?background=1`).

**Why not just widen the window / always full:** incremental exists to avoid re-upserting thousands of leads and timeouts on large accounts. Full is gated to the user-initiated manual path on purpose.
