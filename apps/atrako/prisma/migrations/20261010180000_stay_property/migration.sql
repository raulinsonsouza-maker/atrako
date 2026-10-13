CREATE TABLE IF NOT EXISTS "StayProperty" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "name" VARCHAR(160) NOT NULL,
  "headline" VARCHAR(200),
  "story" TEXT,
  "concept" TEXT,
  "photos" JSONB NOT NULL DEFAULT '[]',
  "features" JSONB NOT NULL DEFAULT '[]',
  "highlights" JSONB NOT NULL DEFAULT '[]',
  "nightlyCents" INTEGER NOT NULL DEFAULT 89000,
  "cleaningFeeCents" INTEGER NOT NULL DEFAULT 0,
  "minNights" INTEGER NOT NULL DEFAULT 2,
  "maxNights" INTEGER NOT NULL DEFAULT 14,
  "checkInTime" VARCHAR(5) NOT NULL DEFAULT '15:00',
  "checkOutTime" VARCHAR(5) NOT NULL DEFAULT '11:00',
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  "published" BOOLEAN NOT NULL DEFAULT true,
  "acceptingBookings" BOOLEAN NOT NULL DEFAULT true,
  "heroFrameCount" INTEGER NOT NULL DEFAULT 0,
  "nextNumber" INTEGER NOT NULL DEFAULT 1000,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayProperty_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StayProperty_clienteId_key" ON "StayProperty"("clienteId");
CREATE UNIQUE INDEX IF NOT EXISTS "StayProperty_slug_key" ON "StayProperty"("slug");

CREATE TABLE IF NOT EXISTS "StayBlock" (
  "id" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "startDate" VARCHAR(10) NOT NULL,
  "endDate" VARCHAR(10) NOT NULL,
  "reason" VARCHAR(160),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayBlock_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "StayBlock_propertyId_startDate_idx" ON "StayBlock"("propertyId", "startDate");

CREATE TABLE IF NOT EXISTS "StayReservation" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "propertyId" TEXT NOT NULL,
  "number" INTEGER NOT NULL,
  "publicToken" VARCHAR(64) NOT NULL,
  "clientRequestId" VARCHAR(80),
  "contactId" TEXT,
  "leadId" TEXT,
  "guestName" VARCHAR(200) NOT NULL,
  "guestEmail" VARCHAR(255),
  "guestPhone" VARCHAR(40) NOT NULL,
  "phoneE164" VARCHAR(20),
  "guests" INTEGER NOT NULL DEFAULT 1,
  "checkIn" VARCHAR(10) NOT NULL,
  "checkOut" VARCHAR(10) NOT NULL,
  "nights" INTEGER NOT NULL,
  "amountCents" INTEGER NOT NULL,
  "nightlyCents" INTEGER NOT NULL,
  "cleaningFeeCents" INTEGER NOT NULL DEFAULT 0,
  "status" VARCHAR(24) NOT NULL DEFAULT 'PENDING_PAYMENT',
  "channel" VARCHAR(16) NOT NULL DEFAULT 'STORE',
  "notes" TEXT,
  "mpOrderId" VARCHAR(120),
  "pixQrCode" TEXT,
  "pixQrCodeBase64" TEXT,
  "pixCopyPaste" TEXT,
  "holdExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "reminderSentAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "StayReservation_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "StayReservation_publicToken_key" ON "StayReservation"("publicToken");
CREATE UNIQUE INDEX IF NOT EXISTS "StayReservation_propertyId_clientRequestId_key" ON "StayReservation"("propertyId", "clientRequestId");
CREATE UNIQUE INDEX IF NOT EXISTS "StayReservation_propertyId_number_key" ON "StayReservation"("propertyId", "number");
CREATE INDEX IF NOT EXISTS "StayReservation_clienteId_checkIn_idx" ON "StayReservation"("clienteId", "checkIn");
CREATE INDEX IF NOT EXISTS "StayReservation_clienteId_status_idx" ON "StayReservation"("clienteId", "status");
CREATE INDEX IF NOT EXISTS "StayReservation_mpOrderId_idx" ON "StayReservation"("mpOrderId");
CREATE INDEX IF NOT EXISTS "StayReservation_contactId_idx" ON "StayReservation"("contactId");
CREATE INDEX IF NOT EXISTS "StayReservation_propertyId_status_idx" ON "StayReservation"("propertyId", "status");

DO $$ BEGIN
  ALTER TABLE "StayProperty" ADD CONSTRAINT "StayProperty_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StayBlock" ADD CONSTRAINT "StayBlock_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StayReservation" ADD CONSTRAINT "StayReservation_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StayReservation" ADD CONSTRAINT "StayReservation_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "StayProperty"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "StayReservation" ADD CONSTRAINT "StayReservation_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
