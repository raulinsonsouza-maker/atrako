---
name: CRM attribution filters live in per-env DB, not code
description: Why dev filter changes don't reach production and how to change them in prod
---

CRM attribution filters (tagFilter, midiaFilter, origemUltimoFilter, conversaoOriginalFilter, conversaoUltimoFilter) are stored in `CrmConfig.credenciais` (JSON) **per client, per database**. They are read by `getCrmFilters` and applied (AND-combined) in the crm atribuicao/funil/leads routes.

**Why this matters:** Replit publish ships **code only** — it does NOT copy database rows. Production uses a **separate database** from the dev/preview environment (different IDs, different lead data, different CrmConfig). So editing a filter in the dev DB (e.g. via executeSql) never appears in production. And executeSql can only READ production, not write it.

**How to apply:** To change a filter in production, change it through the running production app (which writes to the prod DB). These filters are now editable in the admin panel CRM config form (CVCRM section, "Filtros de atribuição"). The admin PUT merges incoming creds over existing for CVCRM/RDSTATION so saving never wipes unmanaged keys; empty input sends `[]` and clears that filter. Before this, midiaFilter/origemUltimoFilter/conversao* were only settable by direct DB edits, so prod could never be corrected via the app.

**Concrete case:** Google paid leads sometimes arrive in CVCRM labeled `origemUltimo = "Busca Orgânica"` (UTM/gclid not tagging them as paid). To count them as Google, add "Busca Orgânica" to the origemUltimo filter for that client.
