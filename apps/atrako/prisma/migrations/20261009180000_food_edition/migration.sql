ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "edition" VARCHAR(32) NOT NULL DEFAULT 'custom';

CREATE TABLE IF NOT EXISTS "FoodStore" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  "acceptingOrders" BOOLEAN NOT NULL DEFAULT true,
  "deliveryEnabled" BOOLEAN NOT NULL DEFAULT true,
  "pickupEnabled" BOOLEAN NOT NULL DEFAULT true,
  "deliveryFeeCents" INTEGER NOT NULL DEFAULT 500,
  "minOrderCents" INTEGER NOT NULL DEFAULT 0,
  "pickupName" VARCHAR(160),
  "pickupAddress" VARCHAR(255),
  "pickupInstructions" VARCHAR(255),
  "nextNumber" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodStore_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodStore_clienteId_key" ON "FoodStore"("clienteId");
CREATE UNIQUE INDEX IF NOT EXISTS "FoodStore_slug_key" ON "FoodStore"("slug");

CREATE TABLE IF NOT EXISTS "FoodCategory" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "slug" VARCHAR(40) NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "FoodCategory_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodCategory_storeId_slug_key" ON "FoodCategory"("storeId", "slug");

CREATE TABLE IF NOT EXISTS "FoodItem" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "categoryId" TEXT NOT NULL,
  "key" VARCHAR(40) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL,
  "imageUrl" VARCHAR(255),
  "emoji" VARCHAR(8),
  "badge" VARCHAR(40),
  "calories" INTEGER,
  "allergens" VARCHAR(255),
  "ingredients" JSONB,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FoodItem_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodItem_storeId_key_key" ON "FoodItem"("storeId", "key");
CREATE INDEX IF NOT EXISTS "FoodItem_storeId_available_idx" ON "FoodItem"("storeId", "available");
CREATE INDEX IF NOT EXISTS "FoodCategory_storeId_sortOrder_idx" ON "FoodCategory"("storeId", "sortOrder");

CREATE TABLE IF NOT EXISTS "FoodCoupon" (
  "id" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "code" VARCHAR(40) NOT NULL,
  "type" VARCHAR(16) NOT NULL,
  "value" INTEGER NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  CONSTRAINT "FoodCoupon_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodCoupon_storeId_code_key" ON "FoodCoupon"("storeId", "code");

CREATE TABLE IF NOT EXISTS "FoodOrder" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "storeId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "publicToken" VARCHAR(64) NOT NULL,
  "clientRequestId" VARCHAR(80) NOT NULL,
  "contactId" TEXT,
  "leadId" TEXT,
  "customerName" VARCHAR(200) NOT NULL,
  "phone" VARCHAR(40) NOT NULL,
  "phoneE164" VARCHAR(20),
  "fulfillment" VARCHAR(16) NOT NULL,
  "address" JSONB,
  "paymentMethod" VARCHAR(24) NOT NULL,
  "paymentStatus" VARCHAR(24) NOT NULL DEFAULT 'PENDING',
  "fulfillmentStatus" VARCHAR(24) NOT NULL DEFAULT 'NEW',
  "subtotalCents" INTEGER NOT NULL,
  "discountCents" INTEGER NOT NULL DEFAULT 0,
  "deliveryFeeCents" INTEGER NOT NULL DEFAULT 0,
  "totalCents" INTEGER NOT NULL,
  "couponCode" VARCHAR(40),
  "changeForCents" INTEGER,
  "notes" TEXT,
  "mpOrderId" VARCHAR(120),
  "pixQrCode" TEXT,
  "pixQrCodeBase64" TEXT,
  "pixCopyPaste" TEXT,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodOrder_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "FoodOrder_publicToken_key" ON "FoodOrder"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "FoodOrder_storeId_clientRequestId_key" ON "FoodOrder"("storeId", "clientRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "FoodOrder_storeId_number_key" ON "FoodOrder"("storeId", "number");
CREATE INDEX IF NOT EXISTS "FoodOrder_clienteId_createdAt_idx" ON "FoodOrder"("clienteId", "createdAt");
CREATE INDEX IF NOT EXISTS "FoodOrder_clienteId_fulfillmentStatus_idx" ON "FoodOrder"("clienteId", "fulfillmentStatus");
CREATE INDEX IF NOT EXISTS "FoodOrder_mpOrderId_idx" ON "FoodOrder"("mpOrderId");
CREATE INDEX IF NOT EXISTS "FoodOrder_contactId_idx" ON "FoodOrder"("contactId");

CREATE TABLE IF NOT EXISTS "FoodOrderItem" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "itemId" TEXT,
  "name" VARCHAR(160) NOT NULL,
  "priceCents" INTEGER NOT NULL,
  "quantity" INTEGER NOT NULL,
  "removals" JSONB,
  "notes" VARCHAR(200),
  CONSTRAINT "FoodOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FoodOrderItem_orderId_idx" ON "FoodOrderItem"("orderId");

CREATE TABLE IF NOT EXISTS "FoodOrderEvent" (
  "id" TEXT NOT NULL,
  "orderId" TEXT NOT NULL,
  "kind" VARCHAR(40) NOT NULL,
  "fromValue" VARCHAR(24),
  "toValue" VARCHAR(24),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "FoodOrderEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "FoodOrderEvent_orderId_createdAt_idx" ON "FoodOrderEvent"("orderId", "createdAt");

DO $$ BEGIN
  ALTER TABLE "FoodStore" ADD CONSTRAINT "FoodStore_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodCategory" ADD CONSTRAINT "FoodCategory_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "FoodStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "FoodStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodItem" ADD CONSTRAINT "FoodItem_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "FoodCategory"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodCoupon" ADD CONSTRAINT "FoodCoupon_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "FoodStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_storeId_fkey" FOREIGN KEY ("storeId") REFERENCES "FoodStore"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrder" ADD CONSTRAINT "FoodOrder_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrderItem" ADD CONSTRAINT "FoodOrderItem_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoodItem"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodOrderEvent" ADD CONSTRAINT "FoodOrderEvent_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "FoodOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
