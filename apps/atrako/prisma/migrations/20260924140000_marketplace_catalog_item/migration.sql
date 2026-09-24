-- CreateTable
CREATE TABLE "MarketplaceCatalogItem" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "externalId" VARCHAR(80) NOT NULL,
    "title" VARCHAR(300) NOT NULL,
    "status" VARCHAR(40),
    "sku" VARCHAR(120),
    "priceCents" INTEGER,
    "rawPayload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceCatalogItem_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "MarketplaceCatalogItem_clienteId_provider_updatedAt_idx" ON "MarketplaceCatalogItem"("clienteId", "provider", "updatedAt");

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceCatalogItem_clienteId_provider_externalId_key" ON "MarketplaceCatalogItem"("clienteId", "provider", "externalId");

-- AddForeignKey
ALTER TABLE "MarketplaceCatalogItem" ADD CONSTRAINT "MarketplaceCatalogItem_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
