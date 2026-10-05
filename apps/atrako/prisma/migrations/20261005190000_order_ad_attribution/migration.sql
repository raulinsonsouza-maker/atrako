-- CreateTable
CREATE TABLE "MarketplaceOrderSource" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "channel" VARCHAR(40) NOT NULL,
    "storeSource" VARCHAR(200),
    "storeMedium" VARCHAR(120),
    "storeCampaign" VARCHAR(300),
    "storeContent" VARCHAR(300),
    "storeTerm" VARCHAR(300),
    "referrer" VARCHAR(500),
    "landingUrl" TEXT,
    "deviceType" VARCHAR(40),
    "sessionPages" INTEGER,
    "sessionCount" INTEGER,
    "hasFbclid" BOOLEAN NOT NULL DEFAULT false,
    "adMethod" VARCHAR(20),
    "adConfidence" VARCHAR(20),
    "adWindow" VARCHAR(10),
    "metaCampaignId" VARCHAR(40),
    "metaCampaignName" VARCHAR(300),
    "metaAdsetId" VARCHAR(40),
    "metaAdsetName" VARCHAR(300),
    "metaAdId" VARCHAR(40),
    "metaAdName" VARCHAR(300),
    "matchedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MarketplaceOrderSource_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MetaAdPurchaseDaily" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "adAccountId" VARCHAR(40) NOT NULL,
    "date" DATE NOT NULL,
    "campaignId" VARCHAR(40) NOT NULL,
    "campaignName" VARCHAR(300) NOT NULL,
    "adsetId" VARCHAR(40) NOT NULL,
    "adsetName" VARCHAR(300) NOT NULL,
    "adId" VARCHAR(40) NOT NULL,
    "adName" VARCHAR(300) NOT NULL,
    "clickPurchases" INTEGER NOT NULL DEFAULT 0,
    "clickValueCents" INTEGER NOT NULL DEFAULT 0,
    "viewPurchases" INTEGER NOT NULL DEFAULT 0,
    "viewValueCents" INTEGER NOT NULL DEFAULT 0,
    "syncedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MetaAdPurchaseDaily_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MarketplaceOrderSource_orderId_key" ON "MarketplaceOrderSource"("orderId");
CREATE INDEX "MarketplaceOrderSource_clienteId_channel_idx" ON "MarketplaceOrderSource"("clienteId", "channel");
CREATE INDEX "MarketplaceOrderSource_clienteId_metaCampaignId_idx" ON "MarketplaceOrderSource"("clienteId", "metaCampaignId");
CREATE INDEX "MarketplaceOrderSource_clienteId_metaAdId_idx" ON "MarketplaceOrderSource"("clienteId", "metaAdId");
CREATE UNIQUE INDEX "MetaAdPurchaseDaily_clienteId_adId_date_key" ON "MetaAdPurchaseDaily"("clienteId", "adId", "date");
CREATE INDEX "MetaAdPurchaseDaily_clienteId_date_idx" ON "MetaAdPurchaseDaily"("clienteId", "date");

-- AddForeignKey
ALTER TABLE "MarketplaceOrderSource" ADD CONSTRAINT "MarketplaceOrderSource_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "MarketplaceOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "MetaAdPurchaseDaily" ADD CONSTRAINT "MetaAdPurchaseDaily_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
