-- CreateTable
CREATE TABLE "AbandonedCart" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'checkout',
    "externalId" VARCHAR(120) NOT NULL,
    "contactId" TEXT,
    "leadId" TEXT,
    "name" VARCHAR(200),
    "email" VARCHAR(255),
    "phone" VARCHAR(40),
    "totalCents" INTEGER NOT NULL DEFAULT 0,
    "currency" VARCHAR(8) NOT NULL DEFAULT 'BRL',
    "items" JSONB,
    "recoveryUrl" TEXT,
    "status" VARCHAR(16) NOT NULL DEFAULT 'OPEN',
    "abandonedAt" TIMESTAMP(3) NOT NULL,
    "recoveredAt" TIMESTAMP(3),
    "recoveredOrderId" VARCHAR(120),
    "recoveredCents" INTEGER,
    "notifiedAt" TIMESTAMP(3),
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AbandonedCart_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "AbandonedCart_clienteId_provider_externalId_key" ON "AbandonedCart"("clienteId", "provider", "externalId");

-- CreateIndex
CREATE INDEX "AbandonedCart_clienteId_status_abandonedAt_idx" ON "AbandonedCart"("clienteId", "status", "abandonedAt");

-- CreateIndex
CREATE INDEX "AbandonedCart_clienteId_contactId_idx" ON "AbandonedCart"("clienteId", "contactId");

-- CreateIndex
CREATE INDEX "AbandonedCart_clienteId_email_idx" ON "AbandonedCart"("clienteId", "email");

-- CreateIndex
CREATE INDEX "AbandonedCart_clienteId_phone_idx" ON "AbandonedCart"("clienteId", "phone");

-- AddForeignKey
ALTER TABLE "AbandonedCart" ADD CONSTRAINT "AbandonedCart_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
