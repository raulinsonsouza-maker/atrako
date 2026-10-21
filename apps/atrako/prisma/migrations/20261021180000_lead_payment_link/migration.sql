CREATE TABLE IF NOT EXISTS "LeadPaymentLink" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "leadId" TEXT NOT NULL,
  "token" VARCHAR(64) NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "maxInstallments" INTEGER NOT NULL DEFAULT 1,
  "description" VARCHAR(200) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
  "method" VARCHAR(16),
  "installments" INTEGER,
  "mpOrderId" VARCHAR(120),
  "pixQrCode" TEXT,
  "pixQrCodeBase64" TEXT,
  "payerName" VARCHAR(200),
  "payerEmail" VARCHAR(255),
  "sentVia" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "createdById" VARCHAR(64),
  "createdByName" VARCHAR(160),
  "expiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "LeadPaymentLink_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LeadPaymentLink_token_key" ON "LeadPaymentLink"("token");
CREATE INDEX IF NOT EXISTS "LeadPaymentLink_clienteId_status_idx" ON "LeadPaymentLink"("clienteId", "status");
CREATE INDEX IF NOT EXISTS "LeadPaymentLink_clienteId_createdAt_idx" ON "LeadPaymentLink"("clienteId", "createdAt");
CREATE INDEX IF NOT EXISTS "LeadPaymentLink_leadId_idx" ON "LeadPaymentLink"("leadId");
CREATE INDEX IF NOT EXISTS "LeadPaymentLink_mpOrderId_idx" ON "LeadPaymentLink"("mpOrderId");

DO $$ BEGIN
  ALTER TABLE "LeadPaymentLink" ADD CONSTRAINT "LeadPaymentLink_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
