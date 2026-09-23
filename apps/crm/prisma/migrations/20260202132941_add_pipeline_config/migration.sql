-- AlterTable
ALTER TABLE "LeadStage" ADD COLUMN     "isSystemStage" BOOLEAN NOT NULL DEFAULT false;

-- Marcar estágios fixos existentes
UPDATE "LeadStage" SET "isSystemStage" = true 
WHERE LOWER("name") LIKE '%novo%' AND "order" = 0
   OR LOWER("name") LIKE '%ganho%'
   OR LOWER("name") LIKE '%perdido%';
