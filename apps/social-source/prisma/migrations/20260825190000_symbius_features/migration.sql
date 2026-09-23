-- Symbius Flow feature expansion

ALTER TABLE "OrganizationMember" ADD COLUMN IF NOT EXISTS "pinnedAt" TIMESTAMP(3);

ALTER TABLE "IgAccount" ADD COLUMN IF NOT EXISTS "defaultReplyText" TEXT;
ALTER TABLE "IgAccount" ADD COLUMN IF NOT EXISTS "iceBreakers" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "IgContato" ADD COLUMN IF NOT EXISTS "campos" JSONB NOT NULL DEFAULT '{}';
ALTER TABLE "IgContato" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE "IgConversa" ADD COLUMN IF NOT EXISTS "assignedUserId" TEXT;

ALTER TABLE "IgFluxo" ADD COLUMN IF NOT EXISTS "fluxoKind" TEXT NOT NULL DEFAULT 'automation';

CREATE TABLE IF NOT EXISTS "IgOrgSettings" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "apiKey" TEXT,
    "webhookUrl" TEXT,
    "webhookEvents" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "googleSheetId" TEXT,
    "googleSheetTab" TEXT,
    "syncCentralCrm" BOOLEAN NOT NULL DEFAULT false,
    "aiEnabled" BOOLEAN NOT NULL DEFAULT false,
    "aiKnowledgeBase" TEXT,
    "aiGoals" JSONB NOT NULL DEFAULT '{}',
    "aiTone" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IgOrgSettings_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IgOrgSettings_organizationId_key" ON "IgOrgSettings"("organizationId");

CREATE TABLE IF NOT EXISTS "IgSnippet" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "shortcut" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IgSnippet_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IgSnippet_organizationId_idx" ON "IgSnippet"("organizationId");

CREATE TABLE IF NOT EXISTS "IgTagDefinition" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "cor" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgTagDefinition_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IgTagDefinition_organizationId_nome_key" ON "IgTagDefinition"("organizationId", "nome");
CREATE INDEX IF NOT EXISTS "IgTagDefinition_organizationId_idx" ON "IgTagDefinition"("organizationId");

CREATE TABLE IF NOT EXISTS "IgSegmento" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "filters" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "IgSegmento_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IgSegmento_organizationId_idx" ON "IgSegmento"("organizationId");

CREATE TABLE IF NOT EXISTS "IgConversionEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "contatoId" TEXT,
    "fluxoId" TEXT,
    "tipo" TEXT NOT NULL,
    "metadata" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgConversionEvent_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IgConversionEvent_organizationId_createdAt_idx" ON "IgConversionEvent"("organizationId", "createdAt");
CREATE INDEX IF NOT EXISTS "IgConversionEvent_tipo_idx" ON "IgConversionEvent"("tipo");

CREATE TABLE IF NOT EXISTS "IgMemberInvite" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'AGENT',
    "token" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgMemberInvite_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "IgMemberInvite_token_key" ON "IgMemberInvite"("token");
CREATE INDEX IF NOT EXISTS "IgMemberInvite_organizationId_idx" ON "IgMemberInvite"("organizationId");
CREATE INDEX IF NOT EXISTS "IgMemberInvite_token_idx" ON "IgMemberInvite"("token");

CREATE TABLE IF NOT EXISTS "IgScheduledMessage" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "texto" TEXT NOT NULL,
    "scheduledAt" TIMESTAMP(3) NOT NULL,
    "sentAt" TIMESTAMP(3),
    "sentByUserId" TEXT,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "IgScheduledMessage_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "IgScheduledMessage_scheduledAt_sentAt_idx" ON "IgScheduledMessage"("scheduledAt", "sentAt");
CREATE INDEX IF NOT EXISTS "IgScheduledMessage_organizationId_idx" ON "IgScheduledMessage"("organizationId");

ALTER TABLE "IgOrgSettings" ADD CONSTRAINT "IgOrgSettings_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgSnippet" ADD CONSTRAINT "IgSnippet_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgTagDefinition" ADD CONSTRAINT "IgTagDefinition_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgSegmento" ADD CONSTRAINT "IgSegmento_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgConversionEvent" ADD CONSTRAINT "IgConversionEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgMemberInvite" ADD CONSTRAINT "IgMemberInvite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgScheduledMessage" ADD CONSTRAINT "IgScheduledMessage_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
