-- Loja nativa Tray-like: store, categorias, variantes, frete e campos de pedido multi-item

CREATE TABLE IF NOT EXISTS "CommerceStore" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "slug" VARCHAR(80) NOT NULL,
    "name" VARCHAR(160) NOT NULL,
    "published" BOOLEAN NOT NULL DEFAULT true,
    "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
    "shipEnabled" BOOLEAN NOT NULL DEFAULT true,
    "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
    "minOrderCents" INTEGER NOT NULL DEFAULT 0,
    "shippingRules" JSONB NOT NULL DEFAULT '{}',
    "pickupName" VARCHAR(160),
    "pickupAddress" VARCHAR(255),
    "pickupInstructions" VARCHAR(255),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceStore_clienteId_key" ON "CommerceStore"("clienteId");
CREATE UNIQUE INDEX IF NOT EXISTS "CommerceStore_slug_key" ON "CommerceStore"("slug");
CREATE INDEX IF NOT EXISTS "CommerceStore_published_idx" ON "CommerceStore"("published");

CREATE TABLE IF NOT EXISTS "CommerceCategory" (
    "id" TEXT NOT NULL,
    "storeId" TEXT NOT NULL,
    "name" VARCHAR(80) NOT NULL,
    "slug" VARCHAR(40) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    CONSTRAINT "CommerceCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceCategory_storeId_slug_key" ON "CommerceCategory"("storeId", "slug");
CREATE INDEX IF NOT EXISTS "CommerceCategory_storeId_sortOrder_idx" ON "CommerceCategory"("storeId", "sortOrder");

ALTER TABLE "CommerceProduct" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "CommerceProduct" ADD COLUMN IF NOT EXISTS "categoryId" TEXT;
ALTER TABLE "CommerceProduct" ADD COLUMN IF NOT EXISTS "kind" VARCHAR(20) NOT NULL DEFAULT 'DIGITAL';
ALTER TABLE "CommerceProduct" ADD COLUMN IF NOT EXISTS "images" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "CommerceProduct" ADD COLUMN IF NOT EXISTS "stockTracked" BOOLEAN NOT NULL DEFAULT false;

CREATE INDEX IF NOT EXISTS "CommerceProduct_storeId_active_idx" ON "CommerceProduct"("storeId", "active");
CREATE INDEX IF NOT EXISTS "CommerceProduct_categoryId_idx" ON "CommerceProduct"("categoryId");
CREATE INDEX IF NOT EXISTS "CommerceProduct_clienteId_kind_idx" ON "CommerceProduct"("clienteId", "kind");

CREATE TABLE IF NOT EXISTS "CommerceVariant" (
    "id" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "sku" VARCHAR(64),
    "options" JSONB NOT NULL DEFAULT '{}',
    "priceCents" INTEGER,
    "stockQty" INTEGER NOT NULL DEFAULT 0,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "CommerceVariant_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "CommerceVariant_productId_active_idx" ON "CommerceVariant"("productId", "active");
CREATE INDEX IF NOT EXISTS "CommerceVariant_productId_sku_idx" ON "CommerceVariant"("productId", "sku");

ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "storeId" TEXT;
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "shippingFeeCents" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "fulfillment" VARCHAR(16) NOT NULL DEFAULT 'DIGITAL';
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "fulfillmentStatus" VARCHAR(24) NOT NULL DEFAULT 'NEW';
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "shippingAddress" JSONB;
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "shippingQuote" JSONB;
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "publicToken" VARCHAR(64);
ALTER TABLE "CommerceOrder" ADD COLUMN IF NOT EXISTS "clientRequestId" VARCHAR(80);

CREATE UNIQUE INDEX IF NOT EXISTS "CommerceOrder_publicToken_key" ON "CommerceOrder"("publicToken");
CREATE INDEX IF NOT EXISTS "CommerceOrder_storeId_createdAt_idx" ON "CommerceOrder"("storeId", "createdAt");
CREATE INDEX IF NOT EXISTS "CommerceOrder_storeId_clientRequestId_idx" ON "CommerceOrder"("storeId", "clientRequestId");

ALTER TABLE "CommerceOrderItem" ADD COLUMN IF NOT EXISTS "variantId" TEXT;
ALTER TABLE "CommerceOrderItem" ADD COLUMN IF NOT EXISTS "options" JSONB;
CREATE INDEX IF NOT EXISTS "CommerceOrderItem_variantId_idx" ON "CommerceOrderItem"("variantId");

DO $$ BEGIN
  ALTER TABLE "CommerceStore" ADD CONSTRAINT "CommerceStore_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceCategory" ADD CONSTRAINT "CommerceCategory_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceProduct" ADD CONSTRAINT "CommerceProduct_categoryId_fkey"
    FOREIGN KEY ("categoryId") REFERENCES "CommerceCategory"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceVariant" ADD CONSTRAINT "CommerceVariant_productId_fkey"
    FOREIGN KEY ("productId") REFERENCES "CommerceProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceOrder" ADD CONSTRAINT "CommerceOrder_storeId_fkey"
    FOREIGN KEY ("storeId") REFERENCES "CommerceStore"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "CommerceOrderItem" ADD CONSTRAINT "CommerceOrderItem_variantId_fkey"
    FOREIGN KEY ("variantId") REFERENCES "CommerceVariant"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
