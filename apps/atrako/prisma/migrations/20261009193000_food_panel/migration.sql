ALTER TABLE "FoodStore" ADD COLUMN IF NOT EXISTS "hours" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "FoodItem" ADD COLUMN IF NOT EXISTS "schedule" JSONB;
ALTER TABLE "FoodOrder" ADD COLUMN IF NOT EXISTS "channel" VARCHAR(16) NOT NULL DEFAULT 'STORE';
ALTER TABLE "FoodOrderItem" ADD COLUMN IF NOT EXISTS "additions" JSONB;
ALTER TABLE "WaConversation" ADD COLUMN IF NOT EXISTS "foodCart" JSONB;

CREATE INDEX IF NOT EXISTS "FoodOrder_clienteId_channel_idx" ON "FoodOrder"("clienteId", "channel");

CREATE TABLE IF NOT EXISTS "FoodModifierGroup" (
  "id" TEXT NOT NULL,
  "itemId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "minSelect" INTEGER NOT NULL DEFAULT 0,
  "maxSelect" INTEGER NOT NULL DEFAULT 1,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FoodModifierGroup_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FoodModifierGroup_itemId_sortOrder_idx" ON "FoodModifierGroup"("itemId", "sortOrder");

CREATE TABLE IF NOT EXISTS "FoodModifierOption" (
  "id" TEXT NOT NULL,
  "groupId" TEXT NOT NULL,
  "name" VARCHAR(80) NOT NULL,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "available" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "FoodModifierOption_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "FoodModifierOption_groupId_sortOrder_idx" ON "FoodModifierOption"("groupId", "sortOrder");

DO $$ BEGIN
  ALTER TABLE "FoodModifierGroup" ADD CONSTRAINT "FoodModifierGroup_itemId_fkey" FOREIGN KEY ("itemId") REFERENCES "FoodItem"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "FoodModifierOption" ADD CONSTRAINT "FoodModifierOption_groupId_fkey" FOREIGN KEY ("groupId") REFERENCES "FoodModifierGroup"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
