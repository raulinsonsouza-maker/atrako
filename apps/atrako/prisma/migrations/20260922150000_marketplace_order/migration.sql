-- CreateTable
CREATE TABLE "MarketplaceOrder" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "externalId" VARCHAR(80) NOT NULL,
    "status" VARCHAR(40),
    "totalCents" INTEGER,
    "currency" VARCHAR(8) DEFAULT 'BRL',
    "contactId" TEXT,
    "leadId" TEXT,
    "buyerName" VARCHAR(200),
    "buyerEmail" VARCHAR(255),
    "buyerPhone" VARCHAR(40),
    "rawPayload" JSONB,
    "occurredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrder_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceOrder_clienteId_provider_occurredAt_idx" ON "MarketplaceOrder"("clienteId", "provider", "occurredAt");

-- CreateIndex
CREATE INDEX "MarketplaceOrder_clienteId_createdAt_idx" ON "MarketplaceOrder"("clienteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrder_clienteId_provider_externalId_key" ON "MarketplaceOrder"("clienteId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MarketplaceOrder" ADD CONSTRAINT "MarketplaceOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
