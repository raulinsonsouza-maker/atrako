ALTER TABLE "AnalystConversation" ADD COLUMN "ownerUserId" TEXT;

CREATE INDEX "AnalystConversation_clienteId_ownerUserId_updatedAt_idx"
  ON "AnalystConversation"("clienteId", "ownerUserId", "updatedAt");

ALTER TABLE "AnalystConversation"
  ADD CONSTRAINT "AnalystConversation_ownerUserId_fkey"
  FOREIGN KEY ("ownerUserId") REFERENCES "InternalUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;