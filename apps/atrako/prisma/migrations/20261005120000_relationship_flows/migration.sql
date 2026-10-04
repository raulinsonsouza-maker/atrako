-- AlterTable
ALTER TABLE "WorkspaceSettings" ADD COLUMN     "messagingPrefs" JSONB NOT NULL DEFAULT '{}';

-- AlterTable
ALTER TABLE "NativeContact" ADD COLUMN     "consentSource" VARCHAR(40),
ADD COLUMN     "emailBouncedAt" TIMESTAMP(3),
ADD COLUMN     "emailComplainedAt" TIMESTAMP(3),
ADD COLUMN     "emailOptOutAt" TIMESTAMP(3),
ADD COLUMN     "flowsPausedUntil" TIMESTAMP(3),
ADD COLUMN     "marketingConsentAt" TIMESTAMP(3),
ADD COLUMN     "phoneE164" VARCHAR(20),
ADD COLUMN     "waMarketingBlockedUntil" TIMESTAMP(3),
ADD COLUMN     "waMarketingOptOutAt" TIMESTAMP(3),
ADD COLUMN     "waOptOutAt" TIMESTAMP(3);

-- AlterTable
ALTER TABLE "MarketplaceOrderItem" ADD COLUMN     "imageUrl" VARCHAR(1000),
ADD COLUMN     "productUrl" VARCHAR(1000);

-- AlterTable
ALTER TABLE "MarketplaceCatalogItem" ADD COLUMN     "imageUrl" VARCHAR(1000),
ADD COLUMN     "productUrl" VARCHAR(1000);

-- AlterTable
ALTER TABLE "WaTemplateRef" ADD COLUMN     "components" JSONB,
ADD COLUMN     "lastSyncedAt" TIMESTAMP(3),
ADD COLUMN     "lastUsedAt" TIMESTAMP(3),
ADD COLUMN     "metaTemplateId" VARCHAR(64),
ADD COLUMN     "parameterFormat" VARCHAR(16),
ADD COLUMN     "pauseCount" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "pausedUntil" TIMESTAMP(3),
ADD COLUMN     "purpose" VARCHAR(60),
ADD COLUMN     "qualityScore" VARCHAR(16),
ADD COLUMN     "rejectedReason" VARCHAR(500),
ADD COLUMN     "replacedById" TEXT,
ADD COLUMN     "requestedCategory" VARCHAR(40),
ADD COLUMN     "version" INTEGER NOT NULL DEFAULT 1;

-- CreateTable
CREATE TABLE "WaTemplateEvent" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "templateRefId" TEXT,
    "metaTemplateId" VARCHAR(64),
    "field" VARCHAR(60) NOT NULL,
    "event" VARCHAR(60),
    "detail" VARCHAR(500),
    "payload" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaTemplateEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WaRateCard" (
    "id" TEXT NOT NULL,
    "category" VARCHAR(20) NOT NULL,
    "country" VARCHAR(4) NOT NULL DEFAULT 'BR',
    "currency" VARCHAR(8) NOT NULL DEFAULT 'BRL',
    "priceMicros" INTEGER NOT NULL,
    "effectiveFrom" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WaRateCard_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageFlow" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "key" VARCHAR(60),
    "name" VARCHAR(160) NOT NULL,
    "trigger" VARCHAR(40) NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "pausedReason" VARCHAR(200),
    "priority" INTEGER NOT NULL DEFAULT 50,
    "settings" JSONB NOT NULL DEFAULT '{}',
    "holdoutPercent" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageFlow_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageFlowStep" (
    "id" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "position" INTEGER NOT NULL,
    "delayMinutes" INTEGER NOT NULL DEFAULT 0,
    "channel" VARCHAR(16) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "content" JSONB NOT NULL DEFAULT '{}',
    "draftContent" JSONB,
    "draftUpdatedAt" TIMESTAMP(3),
    "couponCode" VARCHAR(40),
    "couponConfirmed" BOOLEAN NOT NULL DEFAULT false,
    "conditions" JSONB NOT NULL DEFAULT '{}',
    "copyKey" VARCHAR(80),
    "customized" BOOLEAN NOT NULL DEFAULT false,
    "publishedAt" TIMESTAMP(3),
    "testedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageFlowStep_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageFlowEnrollment" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "flowId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "leadId" TEXT,
    "refType" VARCHAR(20),
    "refId" VARCHAR(120),
    "status" VARCHAR(16) NOT NULL DEFAULT 'ACTIVE',
    "stepIndex" INTEGER NOT NULL DEFAULT 0,
    "nextRunAt" TIMESTAMP(3),
    "leaseUntil" TIMESTAMP(3),
    "context" JSONB NOT NULL DEFAULT '{}',
    "holdout" BOOLEAN NOT NULL DEFAULT false,
    "dedupeKey" VARCHAR(160),
    "exitReason" VARCHAR(60),
    "convertedOrderRef" VARCHAR(160),
    "convertedCents" INTEGER,
    "convertedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageFlowEnrollment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaign" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "name" VARCHAR(200) NOT NULL,
    "channel" VARCHAR(16) NOT NULL DEFAULT 'EMAIL',
    "content" JSONB NOT NULL DEFAULT '{}',
    "waTemplateRefId" TEXT,
    "couponCode" VARCHAR(40),
    "audience" JSONB NOT NULL DEFAULT '{}',
    "status" VARCHAR(16) NOT NULL DEFAULT 'IDEIA',
    "briefing" JSONB NOT NULL DEFAULT '{}',
    "checklist" JSONB NOT NULL DEFAULT '{}',
    "ownerMemberId" TEXT,
    "approverMemberId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "approvedByMemberId" TEXT,
    "eventDate" TIMESTAMP(3),
    "scheduledAt" TIMESTAMP(3),
    "testedAt" TIMESTAMP(3),
    "contentUpdatedAt" TIMESTAMP(3),
    "sentAt" TIMESTAMP(3),
    "calendarKey" VARCHAR(80),
    "recipientsCount" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageCampaign_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaignRecipient" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "status" VARCHAR(16) NOT NULL DEFAULT 'PENDING',
    "leaseUntil" TIMESTAMP(3),
    "deliveryId" TEXT,
    "error" VARCHAR(500),
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaignRecipient_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageCampaignComment" (
    "id" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL,
    "memberId" TEXT,
    "authorName" VARCHAR(120),
    "body" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'COMENTARIO',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MessageCampaignComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageDelivery" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "channel" VARCHAR(16) NOT NULL,
    "flowId" TEXT,
    "enrollmentId" TEXT,
    "stepId" TEXT,
    "campaignId" TEXT,
    "contactId" TEXT,
    "toAddress" VARCHAR(255),
    "providerMessageId" VARCHAR(128),
    "trackingToken" VARCHAR(40) NOT NULL,
    "subject" VARCHAR(300),
    "templateName" VARCHAR(120),
    "couponCode" VARCHAR(40),
    "status" VARCHAR(16) NOT NULL DEFAULT 'QUEUED',
    "sentAt" TIMESTAMP(3),
    "deliveredAt" TIMESTAMP(3),
    "openedAt" TIMESTAMP(3),
    "clickedAt" TIMESTAMP(3),
    "convertedAt" TIMESTAMP(3),
    "convertedCents" INTEGER,
    "convertedOrderRef" VARCHAR(160),
    "conversionKind" VARCHAR(16),
    "bouncedAt" TIMESTAMP(3),
    "complainedAt" TIMESTAMP(3),
    "failedAt" TIMESTAMP(3),
    "error" VARCHAR(500),
    "errorCode" INTEGER,
    "pricingCategory" VARCHAR(20),
    "billable" BOOLEAN,
    "costMicros" INTEGER,
    "isTest" BOOLEAN NOT NULL DEFAULT false,
    "contentSnapshot" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MessageDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "MessageEvent" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "deliveryId" TEXT,
    "contactId" TEXT,
    "type" VARCHAR(40) NOT NULL,
    "at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "meta" JSONB,
    "providerEventId" VARCHAR(160),

    CONSTRAINT "MessageEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CustomerProfile" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "ordersCount" INTEGER NOT NULL DEFAULT 0,
    "totalSpentCents" INTEGER NOT NULL DEFAULT 0,
    "firstOrderAt" TIMESTAMP(3),
    "lastOrderAt" TIMESTAMP(3),
    "avgIntervalDays" DOUBLE PRECISION,
    "nextPurchaseAt" TIMESTAMP(3),
    "topProducts" JSONB NOT NULL DEFAULT '[]',
    "lifecycle" VARCHAR(16) NOT NULL DEFAULT 'LEAD',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CustomerProfile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ContactImportantDate" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contactId" TEXT NOT NULL,
    "kind" VARCHAR(16) NOT NULL DEFAULT 'BIRTHDAY',
    "label" VARCHAR(80) NOT NULL DEFAULT 'Aniversário',
    "month" INTEGER NOT NULL,
    "day" INTEGER NOT NULL,
    "year" INTEGER,
    "source" VARCHAR(40),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "ContactImportantDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "EmailTheme" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "draft" JSONB NOT NULL DEFAULT '{}',
    "published" JSONB,
    "publishedAt" TIMESTAMP(3),
    "publishedByMemberId" TEXT,
    "testedAt" TIMESTAMP(3),
    "draftUpdatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "EmailTheme_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorkspaceCalendarDate" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "key" VARCHAR(80) NOT NULL,
    "label" VARCHAR(120) NOT NULL,
    "date" TIMESTAMP(3),
    "recurring" BOOLEAN NOT NULL DEFAULT true,
    "custom" BOOLEAN NOT NULL DEFAULT false,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "leadDays" INTEGER NOT NULL DEFAULT 30,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorkspaceCalendarDate_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Notification" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "memberId" TEXT,
    "role" VARCHAR(16),
    "type" VARCHAR(60) NOT NULL,
    "title" VARCHAR(200) NOT NULL,
    "body" TEXT,
    "href" VARCHAR(300),
    "severity" VARCHAR(16) NOT NULL DEFAULT 'info',
    "dedupeKey" VARCHAR(160),
    "readAt" TIMESTAMP(3),
    "readBy" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "emailedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "JobRun" (
    "id" TEXT NOT NULL,
    "job" VARCHAR(60) NOT NULL,
    "clienteId" TEXT,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "ok" BOOLEAN,
    "stats" JSONB,
    "error" TEXT,

    CONSTRAINT "JobRun_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "WaTemplateEvent_clienteId_createdAt_idx" ON "WaTemplateEvent"("clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "WaTemplateEvent_templateRefId_createdAt_idx" ON "WaTemplateEvent"("templateRefId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WaRateCard_category_country_effectiveFrom_key" ON "WaRateCard"("category", "country", "effectiveFrom");

-- CreateIndex
CREATE INDEX "MessageFlow_clienteId_trigger_status_idx" ON "MessageFlow"("clienteId", "trigger", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageFlow_clienteId_key_key" ON "MessageFlow"("clienteId", "key");

-- CreateIndex
CREATE INDEX "MessageFlowStep_flowId_position_idx" ON "MessageFlowStep"("flowId", "position");

-- CreateIndex
CREATE INDEX "MessageFlowEnrollment_status_nextRunAt_idx" ON "MessageFlowEnrollment"("status", "nextRunAt");

-- CreateIndex
CREATE INDEX "MessageFlowEnrollment_clienteId_contactId_status_idx" ON "MessageFlowEnrollment"("clienteId", "contactId", "status");

-- CreateIndex
CREATE INDEX "MessageFlowEnrollment_flowId_status_idx" ON "MessageFlowEnrollment"("flowId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageFlowEnrollment_flowId_dedupeKey_key" ON "MessageFlowEnrollment"("flowId", "dedupeKey");

-- CreateIndex
CREATE INDEX "MessageCampaign_clienteId_status_idx" ON "MessageCampaign"("clienteId", "status");

-- CreateIndex
CREATE INDEX "MessageCampaign_status_scheduledAt_idx" ON "MessageCampaign"("status", "scheduledAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageCampaign_clienteId_calendarKey_key" ON "MessageCampaign"("clienteId", "calendarKey");

-- CreateIndex
CREATE INDEX "MessageCampaignRecipient_campaignId_status_idx" ON "MessageCampaignRecipient"("campaignId", "status");

-- CreateIndex
CREATE UNIQUE INDEX "MessageCampaignRecipient_campaignId_contactId_key" ON "MessageCampaignRecipient"("campaignId", "contactId");

-- CreateIndex
CREATE INDEX "MessageCampaignComment_campaignId_createdAt_idx" ON "MessageCampaignComment"("campaignId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "MessageDelivery_trackingToken_key" ON "MessageDelivery"("trackingToken");

-- CreateIndex
CREATE INDEX "MessageDelivery_clienteId_createdAt_idx" ON "MessageDelivery"("clienteId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageDelivery_clienteId_contactId_createdAt_idx" ON "MessageDelivery"("clienteId", "contactId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageDelivery_providerMessageId_idx" ON "MessageDelivery"("providerMessageId");

-- CreateIndex
CREATE INDEX "MessageDelivery_enrollmentId_idx" ON "MessageDelivery"("enrollmentId");

-- CreateIndex
CREATE INDEX "MessageDelivery_campaignId_idx" ON "MessageDelivery"("campaignId");

-- CreateIndex
CREATE INDEX "MessageDelivery_clienteId_flowId_createdAt_idx" ON "MessageDelivery"("clienteId", "flowId", "createdAt");

-- CreateIndex
CREATE INDEX "MessageEvent_deliveryId_at_idx" ON "MessageEvent"("deliveryId", "at");

-- CreateIndex
CREATE INDEX "MessageEvent_clienteId_type_at_idx" ON "MessageEvent"("clienteId", "type", "at");

-- CreateIndex
CREATE UNIQUE INDEX "MessageEvent_clienteId_providerEventId_key" ON "MessageEvent"("clienteId", "providerEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CustomerProfile_contactId_key" ON "CustomerProfile"("contactId");

-- CreateIndex
CREATE INDEX "CustomerProfile_clienteId_lifecycle_idx" ON "CustomerProfile"("clienteId", "lifecycle");

-- CreateIndex
CREATE INDEX "CustomerProfile_clienteId_nextPurchaseAt_idx" ON "CustomerProfile"("clienteId", "nextPurchaseAt");

-- CreateIndex
CREATE INDEX "ContactImportantDate_clienteId_month_day_idx" ON "ContactImportantDate"("clienteId", "month", "day");

-- CreateIndex
CREATE UNIQUE INDEX "ContactImportantDate_contactId_kind_label_key" ON "ContactImportantDate"("contactId", "kind", "label");

-- CreateIndex
CREATE UNIQUE INDEX "EmailTheme_clienteId_key" ON "EmailTheme"("clienteId");

-- CreateIndex
CREATE UNIQUE INDEX "WorkspaceCalendarDate_clienteId_key_key" ON "WorkspaceCalendarDate"("clienteId", "key");

-- CreateIndex
CREATE INDEX "Notification_clienteId_createdAt_idx" ON "Notification"("clienteId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Notification_clienteId_dedupeKey_key" ON "Notification"("clienteId", "dedupeKey");

-- CreateIndex
CREATE INDEX "JobRun_job_startedAt_idx" ON "JobRun"("job", "startedAt");

-- CreateIndex
CREATE INDEX "NativeContact_clienteId_phoneE164_idx" ON "NativeContact"("clienteId", "phoneE164");

-- CreateIndex
CREATE INDEX "WaTemplateRef_clienteId_purpose_idx" ON "WaTemplateRef"("clienteId", "purpose");

-- CreateIndex
CREATE INDEX "WaTemplateRef_metaTemplateId_idx" ON "WaTemplateRef"("metaTemplateId");

-- AddForeignKey
ALTER TABLE "WaTemplateEvent" ADD CONSTRAINT "WaTemplateEvent_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WaTemplateEvent" ADD CONSTRAINT "WaTemplateEvent_templateRefId_fkey" FOREIGN KEY ("templateRefId") REFERENCES "WaTemplateRef"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFlow" ADD CONSTRAINT "MessageFlow_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFlowStep" ADD CONSTRAINT "MessageFlowStep_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "MessageFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFlowEnrollment" ADD CONSTRAINT "MessageFlowEnrollment_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFlowEnrollment" ADD CONSTRAINT "MessageFlowEnrollment_flowId_fkey" FOREIGN KEY ("flowId") REFERENCES "MessageFlow"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageFlowEnrollment" ADD CONSTRAINT "MessageFlowEnrollment_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaign" ADD CONSTRAINT "MessageCampaign_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaignRecipient" ADD CONSTRAINT "MessageCampaignRecipient_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageCampaignComment" ADD CONSTRAINT "MessageCampaignComment_campaignId_fkey" FOREIGN KEY ("campaignId") REFERENCES "MessageCampaign"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageDelivery" ADD CONSTRAINT "MessageDelivery_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "MessageEvent" ADD CONSTRAINT "MessageEvent_deliveryId_fkey" FOREIGN KEY ("deliveryId") REFERENCES "MessageDelivery"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CustomerProfile" ADD CONSTRAINT "CustomerProfile_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportantDate" ADD CONSTRAINT "ContactImportantDate_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ContactImportantDate" ADD CONSTRAINT "ContactImportantDate_contactId_fkey" FOREIGN KEY ("contactId") REFERENCES "NativeContact"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "EmailTheme" ADD CONSTRAINT "EmailTheme_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorkspaceCalendarDate" ADD CONSTRAINT "WorkspaceCalendarDate_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Notification" ADD CONSTRAINT "Notification_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Seed: preço por mensagem da Meta no Brasil (BRL, micros)
INSERT INTO "WaRateCard" ("id", "category", "country", "currency", "priceMicros", "effectiveFrom")
VALUES
  ('rate_br_marketing_20261001', 'marketing', 'BR', 'BRL', 321700, '2026-10-01T00:00:00Z'),
  ('rate_br_utility_20261001', 'utility', 'BR', 'BRL', 35000, '2026-10-01T00:00:00Z'),
  ('rate_br_authentication_20261001', 'authentication', 'BR', 'BRL', 35000, '2026-10-01T00:00:00Z')
ON CONFLICT ("category", "country", "effectiveFrom") DO NOTHING;

