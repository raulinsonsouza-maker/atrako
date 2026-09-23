-- AlterTable
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "metadata" JSONB;
