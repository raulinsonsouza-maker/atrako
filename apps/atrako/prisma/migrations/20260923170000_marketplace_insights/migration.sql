-- AlterTable MarketplaceOrder — frete + margem
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "saleFeeCents" INTEGER;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "shippingCostCents" INTEGER;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "netCents" INTEGER;
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "shippingId" VARCHAR(80);
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "shippingStatus" VARCHAR(40);
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "shippingMode" VARCHAR(40);
ALTER TABLE "MarketplaceOrder" ADD COLUMN IF NOT EXISTS "logisticType" VARCHAR(40);

CREATE INDEX IF NOT EXISTS "MarketplaceOrder_clienteId_shippingId_idx" ON "MarketplaceOrder"("clienteId", "shippingId");

-- CreateTable MarketplaceSellerSnapshot
CREATE TABLE IF NOT EXISTS "MarketplaceSellerSnapshot" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "provider" VARCHAR(40) NOT NULL,
    "meliUserId" VARCHAR(40),
    "nickname" VARCHAR(120),
    "reputationLevel" VARCHAR(40),
    "powerSellerStatus" VARCHAR(40),
    "transactionsTotal" INTEGER,
    "ratingsPositive" DOUBLE PRECISION,
    "ratingsNeutral" DOUBLE PRECISION,
    "ratingsNegative" DOUBLE PRECISION,
    "visitsLast30" INTEGER,
    "rawPayload" JSONB,
    "capturedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceSellerSnapshot_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "MarketplaceSellerSnapshot_clienteId_provider_key" ON "MarketplaceSellerSnapshot"("clienteId", "provider");
CREATE INDEX IF NOT EXISTS "MarketplaceSellerSnapshot_clienteId_capturedAt_idx" ON "MarketplaceSellerSnapshot"("clienteId", "capturedAt");

ALTER TABLE "MarketplaceSellerSnapshot" DROP CONSTRAINT IF EXISTS "MarketplaceSellerSnapshot_clienteId_fkey";
ALTER TABLE "MarketplaceSellerSnapshot" ADD CONSTRAINT "MarketplaceSellerSnapshot_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
