---
name: Prisma shadow migration history gap
description: Why new Prisma migrations may fail before reaching their own SQL in this project's development history.
---

`prisma migrate dev` can fail while replaying an older LinkedIn migration because that migration assumes `ConexaoIntegracao` already exists in the shadow database, although the historical chain does not create it first. Do not “fix” this by rewriting applied migration history.

**Why:** Rewriting old migrations risks divergence from databases where those migrations are already recorded. The failure is in historical shadow replay, not necessarily in the new schema change.

**How to apply:** Keep each new migration declarative and reviewable. For development synchronization, use `prisma db push` only after confirming the target is the development database; production rollout still needs a separately approved migration strategy.