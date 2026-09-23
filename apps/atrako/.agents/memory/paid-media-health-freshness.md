---
name: Paid-media health freshness
description: Reliability rules for converting synchronized media facts into account-health colors.
---

Account health freshness must be based on the newest successfully persisted fact for each active channel. A generic client sync timestamp is not proof of fresh data because it may be updated when a sync starts or fails.

**Why:** Using an attempt timestamp can turn stale facts green. Returning gray early can also hide a confirmed red condition from another independent check.

**How to apply:** Evaluate checks independently, then consolidate as RED > YELLOW > GRAY > GREEN. For pacing projections, exclude the current partial day and require at least three complete data days.