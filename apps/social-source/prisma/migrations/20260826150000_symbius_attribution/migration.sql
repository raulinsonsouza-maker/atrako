-- Symbius Attribution layer

ALTER TABLE "IgOrgSettings" ADD COLUMN IF NOT EXISTS "metaPixelId" TEXT;
ALTER TABLE "IgOrgSettings" ADD COLUMN IF NOT EXISTS "metaCapiToken" TEXT;
ALTER TABLE "IgOrgSettings" ADD COLUMN IF NOT EXISTS "ga4MeasurementId" TEXT;
ALTER TABLE "IgOrgSettings" ADD COLUMN IF NOT EXISTS "ga4ApiSecret" TEXT;
ALTER TABLE "IgOrgSettings" ADD COLUMN IF NOT EXISTS "ecommerceConnectors" JSONB NOT NULL DEFAULT '{}';

ALTER TABLE "IgContato" ADD COLUMN IF NOT EXISTS "trackingIdentityId" TEXT;

CREATE TABLE IF NOT EXISTS "TrackingIdentity" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "stId" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "name" TEXT,
    "status" TEXT NOT NULL DEFAULT 'active',
    "leadSource" JSONB,
    "mergedIntoId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingIdentity_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "IdentityAlias" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "identityId" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "value" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IdentityAlias_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrackingVisitor" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "anonymousId" TEXT NOT NULL,
    "identityId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "TrackingVisitor_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrackingSession" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "sessionId" TEXT NOT NULL,
    "visitorId" TEXT NOT NULL,
    "landingPage" TEXT,
    "referrer" TEXT,
    "utmSource" TEXT,
    "utmMedium" TEXT,
    "utmCampaign" TEXT,
    "utmContent" TEXT,
    "utmTerm" TEXT,
    "fbclid" TEXT,
    "gclid" TEXT,
    "ttclid" TEXT,
    "msclkid" TEXT,
    "firstTouch" JSONB,
    "lastTouch" JSONB,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingSession_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "TrackingEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "visitorId" TEXT,
    "sessionId" TEXT,
    "identityId" TEXT,
    "properties" JSONB NOT NULL DEFAULT '{}',
    "context" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "TrackingEvent_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttributionOrder" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "externalOrderId" TEXT NOT NULL,
    "identityId" TEXT,
    "customerExternalId" TEXT,
    "value" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "status" TEXT NOT NULL DEFAULT 'paid',
    "eventId" TEXT,
    "rawPayload" JSONB NOT NULL DEFAULT '{}',
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AttributionOrder_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AttributionOrderItem" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "name" TEXT,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" DECIMAL(12,2) NOT NULL,
    CONSTRAINT "AttributionOrderItem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "OrderAttribution" (
    "id" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "model" TEXT NOT NULL DEFAULT 'first_touch',
    "leadSource" JSONB,
    "saleSource" JSONB,
    "firstTouch" JSONB,
    "lastTouch" JSONB,
    "attributedSource" TEXT,
    "attributedMedium" TEXT,
    "attributedCampaign" TEXT,
    "attributedAdset" TEXT,
    "attributedAd" TEXT,
    "attributedContent" TEXT,
    "attributedValue" DECIMAL(12,2) NOT NULL,
    "linearShares" JSONB,
    CONSTRAINT "OrderAttribution_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "AdSpendDaily" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "platform" TEXT NOT NULL,
    "campaignId" TEXT NOT NULL DEFAULT '',
    "campaignName" TEXT,
    "adsetId" TEXT NOT NULL DEFAULT '',
    "adsetName" TEXT,
    "adId" TEXT NOT NULL DEFAULT '',
    "adName" TEXT,
    "spend" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'BRL',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "AdSpendDaily_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "TrackingIdentity_organizationId_stId_key" ON "TrackingIdentity"("organizationId", "stId");
CREATE INDEX IF NOT EXISTS "TrackingIdentity_organizationId_email_idx" ON "TrackingIdentity"("organizationId", "email");
CREATE INDEX IF NOT EXISTS "TrackingIdentity_organizationId_phone_idx" ON "TrackingIdentity"("organizationId", "phone");
CREATE INDEX IF NOT EXISTS "TrackingIdentity_mergedIntoId_idx" ON "TrackingIdentity"("mergedIntoId");

CREATE UNIQUE INDEX IF NOT EXISTS "IdentityAlias_organizationId_type_value_key" ON "IdentityAlias"("organizationId", "type", "value");
CREATE INDEX IF NOT EXISTS "IdentityAlias_identityId_idx" ON "IdentityAlias"("identityId");

CREATE UNIQUE INDEX IF NOT EXISTS "TrackingVisitor_organizationId_anonymousId_key" ON "TrackingVisitor"("organizationId", "anonymousId");
CREATE INDEX IF NOT EXISTS "TrackingVisitor_identityId_idx" ON "TrackingVisitor"("identityId");

CREATE UNIQUE INDEX IF NOT EXISTS "TrackingSession_organizationId_sessionId_key" ON "TrackingSession"("organizationId", "sessionId");
CREATE INDEX IF NOT EXISTS "TrackingSession_visitorId_idx" ON "TrackingSession"("visitorId");
CREATE INDEX IF NOT EXISTS "TrackingSession_organizationId_startedAt_idx" ON "TrackingSession"("organizationId", "startedAt");

CREATE UNIQUE INDEX IF NOT EXISTS "TrackingEvent_organizationId_eventId_key" ON "TrackingEvent"("organizationId", "eventId");
CREATE INDEX IF NOT EXISTS "TrackingEvent_organizationId_name_occurredAt_idx" ON "TrackingEvent"("organizationId", "name", "occurredAt");
CREATE INDEX IF NOT EXISTS "TrackingEvent_identityId_occurredAt_idx" ON "TrackingEvent"("identityId", "occurredAt");
CREATE INDEX IF NOT EXISTS "TrackingEvent_visitorId_idx" ON "TrackingEvent"("visitorId");

CREATE UNIQUE INDEX IF NOT EXISTS "AttributionOrder_organizationId_externalOrderId_key" ON "AttributionOrder"("organizationId", "externalOrderId");
CREATE INDEX IF NOT EXISTS "AttributionOrder_organizationId_occurredAt_idx" ON "AttributionOrder"("organizationId", "occurredAt");
CREATE INDEX IF NOT EXISTS "AttributionOrder_identityId_idx" ON "AttributionOrder"("identityId");

CREATE INDEX IF NOT EXISTS "AttributionOrderItem_orderId_idx" ON "AttributionOrderItem"("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "OrderAttribution_orderId_key" ON "OrderAttribution"("orderId");

CREATE UNIQUE INDEX IF NOT EXISTS "AdSpendDaily_organizationId_date_platform_campaignId_adsetId_adId_key" ON "AdSpendDaily"("organizationId", "date", "platform", "campaignId", "adsetId", "adId");
CREATE INDEX IF NOT EXISTS "AdSpendDaily_organizationId_date_idx" ON "AdSpendDaily"("organizationId", "date");

CREATE INDEX IF NOT EXISTS "IgContato_trackingIdentityId_idx" ON "IgContato"("trackingIdentityId");

DO $$ BEGIN
  ALTER TABLE "TrackingIdentity" ADD CONSTRAINT "TrackingIdentity_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingIdentity" ADD CONSTRAINT "TrackingIdentity_mergedIntoId_fkey" FOREIGN KEY ("mergedIntoId") REFERENCES "TrackingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IdentityAlias" ADD CONSTRAINT "IdentityAlias_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "TrackingIdentity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingVisitor" ADD CONSTRAINT "TrackingVisitor_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingVisitor" ADD CONSTRAINT "TrackingVisitor_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "TrackingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingSession" ADD CONSTRAINT "TrackingSession_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "TrackingVisitor"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_visitorId_fkey" FOREIGN KEY ("visitorId") REFERENCES "TrackingVisitor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_sessionId_fkey" FOREIGN KEY ("sessionId") REFERENCES "TrackingSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "TrackingEvent" ADD CONSTRAINT "TrackingEvent_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "TrackingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttributionOrder" ADD CONSTRAINT "AttributionOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttributionOrder" ADD CONSTRAINT "AttributionOrder_identityId_fkey" FOREIGN KEY ("identityId") REFERENCES "TrackingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AttributionOrderItem" ADD CONSTRAINT "AttributionOrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AttributionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "OrderAttribution" ADD CONSTRAINT "OrderAttribution_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "AttributionOrder"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "AdSpendDaily" ADD CONSTRAINT "AdSpendDaily_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "IgContato" ADD CONSTRAINT "IgContato_trackingIdentityId_fkey" FOREIGN KEY ("trackingIdentityId") REFERENCES "TrackingIdentity"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
