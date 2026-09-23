---
name: Meta financial balance semantics
description: Distinguishes Meta's financial account balance from the client's internal monthly media budget.
---

The “Saldo Meta” field in Gestão must come from the Meta account balance API or its last valid cache. Never derive it as monthly budget minus synchronized spend; that is remaining internal budget, not the account’s financial balance.

**Why:** These values diverge by design, especially for prepaid boleto/PIX accounts. Treating missing API data as budget remaining or zero presents a plausible but false balance.

**How to apply:** Only replace the cached balance when Meta returns a recognized numeric value, including an explicit zero. On API failures or unparseable prepaid funding details, retain the last valid cache and expose the stale/error state.