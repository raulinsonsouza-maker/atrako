-- Expand Agenda to Book Symbius graph

ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "businessMode" VARCHAR(16) NOT NULL DEFAULT 'SOLO';
ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "agendaPrefs" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "description" TEXT;
ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "imageUrl" TEXT;
ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "bufferBefore" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "bufferAfter" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "AgendaService" ADD COLUMN IF NOT EXISTS "intakeProductId" TEXT;

CREATE TABLE IF NOT EXISTS "AgendaProduct" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "priceCents" INTEGER NOT NULL DEFAULT 0,
  "formConfig" JSONB,
  "productKind" VARCHAR(20) NOT NULL DEFAULT 'SIMPLE',
  "intakeTemplateKey" VARCHAR(80),
  "notifyEmails" JSONB,
  "intakeEmailAlerts" BOOLEAN NOT NULL DEFAULT true,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaProduct_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaProduct_clienteId_isActive_idx" ON "AgendaProduct"("clienteId", "isActive");

CREATE TABLE IF NOT EXISTS "AgendaBookingPage" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "description" TEXT,
  "logoUrl" TEXT,
  "coverImageUrl" TEXT,
  "accentColor" VARCHAR(32),
  "websiteUrl" TEXT,
  "instagram" TEXT,
  "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo',
  "slotStepMinutes" INTEGER NOT NULL DEFAULT 0,
  "funnelConfig" JSONB,
  "isDefault" BOOLEAN NOT NULL DEFAULT false,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaBookingPage_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaBookingPage_clienteId_slug_key" ON "AgendaBookingPage"("clienteId", "slug");
CREATE INDEX IF NOT EXISTS "AgendaBookingPage_clienteId_active_idx" ON "AgendaBookingPage"("clienteId", "active");

CREATE TABLE IF NOT EXISTS "AgendaBookingPageService" (
  "id" TEXT PRIMARY KEY,
  "bookingPageId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AgendaBookingPageService_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "AgendaBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaBookingPageService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AgendaService"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaBookingPageService_bookingPageId_serviceId_key" ON "AgendaBookingPageService"("bookingPageId", "serviceId");
CREATE INDEX IF NOT EXISTS "AgendaBookingPageService_serviceId_idx" ON "AgendaBookingPageService"("serviceId");
CREATE INDEX IF NOT EXISTS "AgendaBookingPageService_bookingPageId_sortOrder_idx" ON "AgendaBookingPageService"("bookingPageId", "sortOrder");

CREATE TABLE IF NOT EXISTS "AgendaProfessional" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "workspaceMemberId" TEXT,
  "displayName" VARCHAR(200) NOT NULL,
  "phone" VARCHAR(40),
  "photoUrl" TEXT,
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  "commissionEnabled" BOOLEAN NOT NULL DEFAULT false,
  "commissionPercent" INTEGER NOT NULL DEFAULT 50,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaProfessional_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaProfessional_clienteId_isActive_sortOrder_idx" ON "AgendaProfessional"("clienteId", "isActive", "sortOrder");

CREATE TABLE IF NOT EXISTS "AgendaProfessionalService" (
  "id" TEXT PRIMARY KEY,
  "professionalId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  CONSTRAINT "AgendaProfessionalService_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "AgendaProfessional"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaProfessionalService_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AgendaService"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaProfessionalService_professionalId_serviceId_key" ON "AgendaProfessionalService"("professionalId", "serviceId");
CREATE INDEX IF NOT EXISTS "AgendaProfessionalService_serviceId_idx" ON "AgendaProfessionalService"("serviceId");

CREATE TABLE IF NOT EXISTS "AgendaAvailabilityRule" (
  "id" TEXT PRIMARY KEY,
  "bookingPageId" TEXT,
  "professionalId" TEXT,
  "dayOfWeek" INTEGER NOT NULL,
  "startTime" VARCHAR(8) NOT NULL,
  "endTime" VARCHAR(8) NOT NULL,
  CONSTRAINT "AgendaAvailabilityRule_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "AgendaBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaAvailabilityRule_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "AgendaProfessional"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaAvailabilityRule_bookingPageId_dayOfWeek_idx" ON "AgendaAvailabilityRule"("bookingPageId", "dayOfWeek");
CREATE INDEX IF NOT EXISTS "AgendaAvailabilityRule_professionalId_dayOfWeek_idx" ON "AgendaAvailabilityRule"("professionalId", "dayOfWeek");

CREATE TABLE IF NOT EXISTS "AgendaAvailabilityException" (
  "id" TEXT PRIMARY KEY,
  "bookingPageId" TEXT,
  "professionalId" TEXT,
  "date" VARCHAR(10) NOT NULL,
  "isBlocked" BOOLEAN NOT NULL DEFAULT true,
  "startTime" VARCHAR(8),
  "endTime" VARCHAR(8),
  CONSTRAINT "AgendaAvailabilityException_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "AgendaBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaAvailabilityException_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "AgendaProfessional"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaAvailabilityException_bookingPageId_date_idx" ON "AgendaAvailabilityException"("bookingPageId", "date");
CREATE INDEX IF NOT EXISTS "AgendaAvailabilityException_professionalId_date_idx" ON "AgendaAvailabilityException"("professionalId", "date");

CREATE TABLE IF NOT EXISTS "AgendaCustomField" (
  "id" TEXT PRIMARY KEY,
  "serviceId" TEXT NOT NULL,
  "label" VARCHAR(120) NOT NULL,
  "type" VARCHAR(20) NOT NULL DEFAULT 'TEXT',
  "required" BOOLEAN NOT NULL DEFAULT false,
  "options" JSONB,
  "sortOrder" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "AgendaCustomField_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AgendaService"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaCustomField_serviceId_sortOrder_idx" ON "AgendaCustomField"("serviceId", "sortOrder");

CREATE TABLE IF NOT EXISTS "AgendaCustomer" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "phoneE164" VARCHAR(40) NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "email" VARCHAR(255),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaCustomer_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaCustomer_clienteId_phoneE164_key" ON "AgendaCustomer"("clienteId", "phoneE164");
CREATE INDEX IF NOT EXISTS "AgendaCustomer_clienteId_phoneE164_idx" ON "AgendaCustomer"("clienteId", "phoneE164");

ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "bookingPageId" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "professionalId" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "customerId" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "customerCpf" VARCHAR(20);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "timezone" VARCHAR(64) NOT NULL DEFAULT 'America/Sao_Paulo';
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "customAnswers" JSONB;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "holdExpiresAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "confirmedAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "cancelledAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "googleEventId" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "googleMeetLink" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "manageToken" VARCHAR(64);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "reminderSentAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "feedbackSentAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "pixReminderSentAt" TIMESTAMP(3);
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "gclid" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "fbclid" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "fbc" TEXT;
ALTER TABLE "AgendaBooking" ADD COLUMN IF NOT EXISTS "fbp" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "AgendaBooking_manageToken_key" ON "AgendaBooking"("manageToken");
CREATE INDEX IF NOT EXISTS "AgendaBooking_bookingPageId_startAt_idx" ON "AgendaBooking"("bookingPageId", "startAt");
CREATE INDEX IF NOT EXISTS "AgendaBooking_professionalId_startAt_idx" ON "AgendaBooking"("professionalId", "startAt");
CREATE INDEX IF NOT EXISTS "AgendaBooking_status_holdExpiresAt_idx" ON "AgendaBooking"("status", "holdExpiresAt");

DO $$ BEGIN
  ALTER TABLE "AgendaBooking" ADD CONSTRAINT "AgendaBooking_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "AgendaBookingPage"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgendaBooking" ADD CONSTRAINT "AgendaBooking_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "AgendaProfessional"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgendaBooking" ADD CONSTRAINT "AgendaBooking_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "AgendaCustomer"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "AgendaService" ADD CONSTRAINT "AgendaService_intakeProductId_fkey" FOREIGN KEY ("intakeProductId") REFERENCES "AgendaProduct"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE TABLE IF NOT EXISTS "AgendaBookingEventLog" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "bookingId" TEXT,
  "type" VARCHAR(80) NOT NULL,
  "dedupeKey" VARCHAR(160) NOT NULL,
  "payload" JSONB,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaBookingEventLog_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaBookingEventLog_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AgendaBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaBookingEventLog_bookingId_type_dedupeKey_key" ON "AgendaBookingEventLog"("bookingId", "type", "dedupeKey");
CREATE INDEX IF NOT EXISTS "AgendaBookingEventLog_clienteId_createdAt_idx" ON "AgendaBookingEventLog"("clienteId", "createdAt");

CREATE TABLE IF NOT EXISTS "AgendaSlotHold" (
  "id" TEXT PRIMARY KEY,
  "bookingPageId" TEXT NOT NULL,
  "serviceId" TEXT NOT NULL,
  "professionalId" TEXT,
  "bookingId" TEXT UNIQUE,
  "startAt" TIMESTAMP(3) NOT NULL,
  "endAt" TIMESTAMP(3) NOT NULL,
  "expiresAt" TIMESTAMP(3) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaSlotHold_bookingPageId_fkey" FOREIGN KEY ("bookingPageId") REFERENCES "AgendaBookingPage"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaSlotHold_serviceId_fkey" FOREIGN KEY ("serviceId") REFERENCES "AgendaService"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaSlotHold_professionalId_fkey" FOREIGN KEY ("professionalId") REFERENCES "AgendaProfessional"("id") ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT "AgendaSlotHold_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AgendaBooking"("id") ON DELETE SET NULL ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaSlotHold_bookingPageId_startAt_expiresAt_idx" ON "AgendaSlotHold"("bookingPageId", "startAt", "expiresAt");
CREATE INDEX IF NOT EXISTS "AgendaSlotHold_professionalId_startAt_expiresAt_idx" ON "AgendaSlotHold"("professionalId", "startAt", "expiresAt");

CREATE TABLE IF NOT EXISTS "AgendaCheckoutLink" (
  "id" TEXT PRIMARY KEY,
  "productId" TEXT NOT NULL,
  "slug" VARCHAR(120) NOT NULL UNIQUE,
  "title" VARCHAR(200),
  "logoUrl" TEXT,
  "accentColor" VARCHAR(32),
  "isActive" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaCheckoutLink_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AgendaProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaCheckoutLink_productId_isActive_idx" ON "AgendaCheckoutLink"("productId", "isActive");

CREATE TABLE IF NOT EXISTS "AgendaCheckoutOrder" (
  "id" TEXT PRIMARY KEY,
  "checkoutLinkId" TEXT NOT NULL,
  "productId" TEXT NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'PENDING_PAYMENT',
  "customerName" VARCHAR(200) NOT NULL,
  "customerEmail" VARCHAR(255) NOT NULL,
  "customerPhone" VARCHAR(40) NOT NULL,
  "customerCpf" VARCHAR(20),
  "customAnswers" JSONB,
  "holdExpiresAt" TIMESTAMP(3),
  "paidAt" TIMESTAMP(3),
  "confirmedAt" TIMESTAMP(3),
  "gclid" TEXT,
  "fbclid" TEXT,
  "fbc" TEXT,
  "fbp" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaCheckoutOrder_checkoutLinkId_fkey" FOREIGN KEY ("checkoutLinkId") REFERENCES "AgendaCheckoutLink"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaCheckoutOrder_productId_fkey" FOREIGN KEY ("productId") REFERENCES "AgendaProduct"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaCheckoutOrder_checkoutLinkId_status_idx" ON "AgendaCheckoutOrder"("checkoutLinkId", "status");
CREATE INDEX IF NOT EXISTS "AgendaCheckoutOrder_productId_status_idx" ON "AgendaCheckoutOrder"("productId", "status");
CREATE INDEX IF NOT EXISTS "AgendaCheckoutOrder_status_holdExpiresAt_idx" ON "AgendaCheckoutOrder"("status", "holdExpiresAt");

CREATE TABLE IF NOT EXISTS "AgendaPayment" (
  "id" TEXT PRIMARY KEY,
  "bookingId" TEXT UNIQUE,
  "checkoutOrderId" TEXT UNIQUE,
  "method" VARCHAR(16) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PENDING',
  "amountCents" INTEGER NOT NULL,
  "currency" VARCHAR(8) NOT NULL DEFAULT 'BRL',
  "provider" VARCHAR(32) NOT NULL DEFAULT 'MERCADO_PAGO',
  "externalId" TEXT,
  "idempotencyKey" VARCHAR(120) NOT NULL UNIQUE,
  "pixQrCode" TEXT,
  "pixQrCodeBase64" TEXT,
  "pixExpiresAt" TIMESTAMP(3),
  "rawResponse" JSONB,
  "paidAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaPayment_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "AgendaBooking"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaPayment_checkoutOrderId_fkey" FOREIGN KEY ("checkoutOrderId") REFERENCES "AgendaCheckoutOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);

CREATE TABLE IF NOT EXISTS "AgendaIntakeSubmission" (
  "id" TEXT PRIMARY KEY,
  "clienteId" TEXT NOT NULL,
  "checkoutOrderId" TEXT NOT NULL UNIQUE,
  "templateKey" VARCHAR(80) NOT NULL,
  "status" VARCHAR(40) NOT NULL DEFAULT 'DRAFT',
  "reviewStatus" VARCHAR(40) NOT NULL DEFAULT 'NEW',
  "data" JSONB NOT NULL,
  "submittedAt" TIMESTAMP(3),
  "viewedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaIntakeSubmission_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT "AgendaIntakeSubmission_checkoutOrderId_fkey" FOREIGN KEY ("checkoutOrderId") REFERENCES "AgendaCheckoutOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE INDEX IF NOT EXISTS "AgendaIntakeSubmission_clienteId_status_idx" ON "AgendaIntakeSubmission"("clienteId", "status");
CREATE INDEX IF NOT EXISTS "AgendaIntakeSubmission_clienteId_reviewStatus_createdAt_idx" ON "AgendaIntakeSubmission"("clienteId", "reviewStatus", "createdAt");

CREATE TABLE IF NOT EXISTS "AgendaIntakeAttachment" (
  "id" TEXT PRIMARY KEY,
  "intakeSubmissionId" TEXT NOT NULL,
  "fieldKey" VARCHAR(80) NOT NULL,
  "partnerIndex" INTEGER,
  "fileName" VARCHAR(255) NOT NULL,
  "mimeType" VARCHAR(120) NOT NULL,
  "sizeBytes" INTEGER NOT NULL,
  "storagePath" VARCHAR(500) NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "AgendaIntakeAttachment_intakeSubmissionId_fkey" FOREIGN KEY ("intakeSubmissionId") REFERENCES "AgendaIntakeSubmission"("id") ON DELETE CASCADE ON UPDATE CASCADE
);
CREATE UNIQUE INDEX IF NOT EXISTS "AgendaIntakeAttachment_intakeSubmissionId_fieldKey_key" ON "AgendaIntakeAttachment"("intakeSubmissionId", "fieldKey");
CREATE INDEX IF NOT EXISTS "AgendaIntakeAttachment_intakeSubmissionId_idx" ON "AgendaIntakeAttachment"("intakeSubmissionId");

-- Backfill: default booking page per workspace with services
INSERT INTO "AgendaBookingPage" ("id", "clienteId", "title", "slug", "isDefault", "active", "createdAt", "updatedAt")
SELECT
  'abp_' || c."id",
  c."id",
  'Agenda',
  'agenda',
  true,
  true,
  CURRENT_TIMESTAMP,
  CURRENT_TIMESTAMP
FROM "Cliente" c
WHERE EXISTS (SELECT 1 FROM "AgendaService" s WHERE s."clienteId" = c."id")
  AND NOT EXISTS (SELECT 1 FROM "AgendaBookingPage" p WHERE p."clienteId" = c."id");

INSERT INTO "AgendaBookingPageService" ("id", "bookingPageId", "serviceId", "sortOrder")
SELECT
  'abps_' || s."id",
  p."id",
  s."id",
  COALESCE(s."sortOrder", 0)
FROM "AgendaService" s
JOIN "AgendaBookingPage" p ON p."clienteId" = s."clienteId" AND p."isDefault" = true
WHERE NOT EXISTS (
  SELECT 1 FROM "AgendaBookingPageService" x WHERE x."serviceId" = s."id" AND x."bookingPageId" = p."id"
);

UPDATE "AgendaBooking" b
SET "bookingPageId" = p."id"
FROM "AgendaBookingPage" p
WHERE p."clienteId" = b."clienteId" AND p."isDefault" = true AND b."bookingPageId" IS NULL;

-- Default Mon–Fri 09:00–18:00 for default pages without rules
INSERT INTO "AgendaAvailabilityRule" ("id", "bookingPageId", "dayOfWeek", "startTime", "endTime")
SELECT
  'aar_' || p."id" || '_' || d.dow,
  p."id",
  d.dow,
  '09:00',
  '18:00'
FROM "AgendaBookingPage" p
CROSS JOIN (VALUES (1),(2),(3),(4),(5)) AS d(dow)
WHERE p."isDefault" = true
  AND NOT EXISTS (SELECT 1 FROM "AgendaAvailabilityRule" r WHERE r."bookingPageId" = p."id");
