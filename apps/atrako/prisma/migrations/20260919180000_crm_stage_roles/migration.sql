-- AlterTable
ALTER TABLE "CrmStage" ADD COLUMN IF NOT EXISTS "role" VARCHAR(16);

-- Backfill essential roles from conventional names
UPDATE "CrmStage" SET "role" = 'ENTRY'
WHERE "role" IS NULL AND lower("name") IN ('novo', 'new', 'entrada');

UPDATE "CrmStage" SET "role" = 'WON'
WHERE "role" IS NULL AND lower("name") IN ('ganho', 'won', 'fechado', 'ganhos');

-- One ENTRY / WON per pipeline: clear duplicates keeping lowest order
UPDATE "CrmStage" AS s
SET "role" = NULL
WHERE s."role" IN ('ENTRY', 'WON')
  AND s."id" NOT IN (
    SELECT DISTINCT ON ("pipelineId", "role") "id"
    FROM "CrmStage"
    WHERE "role" IN ('ENTRY', 'WON')
    ORDER BY "pipelineId", "role", "order" ASC
  );

CREATE UNIQUE INDEX IF NOT EXISTS "CrmStage_pipelineId_role_key"
  ON "CrmStage"("pipelineId", "role")
  WHERE "role" IS NOT NULL;
