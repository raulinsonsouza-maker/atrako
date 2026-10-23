CREATE TABLE IF NOT EXISTS "GeoSite" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "host" VARCHAR(255) NOT NULL,
  "basePath" VARCHAR(64) NOT NULL DEFAULT '/guia',
  "name" VARCHAR(160) NOT NULL,
  "defaultLocale" VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  "locales" TEXT[] DEFAULT ARRAY['pt-BR']::TEXT[],
  "facts" JSONB NOT NULL DEFAULT '{}',
  "indexNowKey" VARCHAR(64),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoSite_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GeoSite_host_key" ON "GeoSite"("host");
CREATE INDEX IF NOT EXISTS "GeoSite_clienteId_idx" ON "GeoSite"("clienteId");

CREATE TABLE IF NOT EXISTS "GeoHub" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "slug" VARCHAR(80) NOT NULL,
  "title" VARCHAR(160) NOT NULL,
  "description" VARCHAR(500),
  "audience" VARCHAR(200),
  "ctaFormSlug" VARCHAR(120),
  "ctaUrl" VARCHAR(500),
  "ctaLabel" VARCHAR(120),
  "position" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoHub_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GeoHub_siteId_slug_key" ON "GeoHub"("siteId", "slug");

CREATE TABLE IF NOT EXISTS "GeoPage" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "hubId" TEXT NOT NULL,
  "locale" VARCHAR(16) NOT NULL DEFAULT 'pt-BR',
  "slug" VARCHAR(120) NOT NULL,
  "type" VARCHAR(24) NOT NULL DEFAULT 'guide',
  "primaryQuestion" VARCHAR(300) NOT NULL,
  "title" VARCHAR(200) NOT NULL,
  "description" VARCHAR(320) NOT NULL,
  "answer" TEXT NOT NULL,
  "body" TEXT NOT NULL,
  "faq" JSONB NOT NULL DEFAULT '[]',
  "sources" JSONB NOT NULL DEFAULT '[]',
  "related" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "status" VARCHAR(16) NOT NULL DEFAULT 'DRAFT',
  "translationGroupId" VARCHAR(64),
  "previousSlugs" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "position" INTEGER NOT NULL DEFAULT 0,
  "publishedAt" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoPage_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GeoPage_siteId_locale_hubId_slug_key" ON "GeoPage"("siteId", "locale", "hubId", "slug");
CREATE INDEX IF NOT EXISTS "GeoPage_siteId_status_idx" ON "GeoPage"("siteId", "status");
CREATE INDEX IF NOT EXISTS "GeoPage_hubId_status_idx" ON "GeoPage"("hubId", "status");

CREATE TABLE IF NOT EXISTS "GeoPrompt" (
  "id" TEXT NOT NULL,
  "siteId" TEXT NOT NULL,
  "hubId" TEXT,
  "text" VARCHAR(300) NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoPrompt_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "GeoPrompt_siteId_text_key" ON "GeoPrompt"("siteId", "text");

CREATE TABLE IF NOT EXISTS "GeoPromptRun" (
  "id" TEXT NOT NULL,
  "promptId" TEXT NOT NULL,
  "engine" VARCHAR(32) NOT NULL,
  "mentioned" BOOLEAN NOT NULL DEFAULT false,
  "cited" BOOLEAN NOT NULL DEFAULT false,
  "citedUrls" TEXT[] DEFAULT ARRAY[]::TEXT[],
  "answer" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoPromptRun_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GeoPromptRun_promptId_createdAt_idx" ON "GeoPromptRun"("promptId", "createdAt");

CREATE TABLE IF NOT EXISTS "GeoHit" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT,
  "host" VARCHAR(255) NOT NULL,
  "kind" VARCHAR(16) NOT NULL,
  "source" VARCHAR(40) NOT NULL,
  "botType" VARCHAR(16),
  "path" VARCHAR(500) NOT NULL,
  "country" VARCHAR(8),
  "referrer" VARCHAR(500),
  "utmSource" VARCHAR(120),
  "sessionId" VARCHAR(64),
  "userAgent" VARCHAR(300),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "GeoHit_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "GeoHit_host_createdAt_idx" ON "GeoHit"("host", "createdAt");
CREATE INDEX IF NOT EXISTS "GeoHit_clienteId_createdAt_idx" ON "GeoHit"("clienteId", "createdAt");
CREATE INDEX IF NOT EXISTS "GeoHit_kind_createdAt_idx" ON "GeoHit"("kind", "createdAt");

DO $$ BEGIN
  ALTER TABLE "GeoSite" ADD CONSTRAINT "GeoSite_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoHub" ADD CONSTRAINT "GeoHub_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "GeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoPage" ADD CONSTRAINT "GeoPage_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "GeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoPage" ADD CONSTRAINT "GeoPage_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "GeoHub"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoPrompt" ADD CONSTRAINT "GeoPrompt_siteId_fkey"
    FOREIGN KEY ("siteId") REFERENCES "GeoSite"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoPrompt" ADD CONSTRAINT "GeoPrompt_hubId_fkey"
    FOREIGN KEY ("hubId") REFERENCES "GeoHub"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "GeoPromptRun" ADD CONSTRAINT "GeoPromptRun_promptId_fkey"
    FOREIGN KEY ("promptId") REFERENCES "GeoPrompt"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
