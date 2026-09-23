-- Backfill script: generate unique portal tokens for all existing clients
-- that do not yet have one. Run once after applying the portalToken migration.
-- Safe to re-run (WHERE clause only touches NULL rows).

UPDATE "Cliente"
SET "portalToken" = gen_random_uuid()::text
WHERE "portalToken" IS NULL;
