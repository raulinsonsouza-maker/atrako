-- Free entry point + entry source + qualification state on WhatsApp conversations
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "fepExpiresAt" TIMESTAMP(3);
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "entrySource" VARCHAR(40);
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "qualification" JSONB;
