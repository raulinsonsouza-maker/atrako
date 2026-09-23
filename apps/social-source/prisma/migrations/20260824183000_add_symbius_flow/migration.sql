-- Symbius Flow: multi-tenant Instagram automations

CREATE TABLE "Organization" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "centralClienteId" TEXT,
    "onboardingDone" BOOLEAN NOT NULL DEFAULT false,
    "maxIgAccounts" INTEGER NOT NULL DEFAULT 1,
    "maxFluxos" INTEGER NOT NULL DEFAULT 3,
    "maxMembers" INTEGER NOT NULL DEFAULT 1,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "User" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "OrganizationMember" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "role" TEXT NOT NULL DEFAULT 'OWNER',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "OrganizationMember_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "plan" TEXT NOT NULL DEFAULT 'FREE',
    "expiresAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgAccount" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "pageId" TEXT NOT NULL,
    "pageName" TEXT,
    "pageAccessToken" TEXT NOT NULL,
    "igUserId" TEXT NOT NULL,
    "igUsername" TEXT,
    "igProfilePictureUrl" TEXT,
    "followersCount" INTEGER,
    "status" TEXT NOT NULL DEFAULT 'CONNECTED',
    "webhookSubscribedAt" TIMESTAMP(3),
    "messagesEnabled" BOOLEAN NOT NULL DEFAULT false,
    "tokenExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgAccount_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgContato" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "igsid" TEXT NOT NULL,
    "nome" TEXT,
    "username" TEXT,
    "tags" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "botPaused" BOOLEAN NOT NULL DEFAULT false,
    "lastInteractionAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgContato_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgConversa" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "handoffHuman" BOOLEAN NOT NULL DEFAULT false,
    "lastMessageAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgConversa_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgMensagem" (
    "id" TEXT NOT NULL,
    "conversaId" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "direction" TEXT NOT NULL,
    "mid" TEXT,
    "texto" TEXT,
    "attachments" JSONB,
    "isEcho" BOOLEAN NOT NULL DEFAULT false,
    "sentByUserId" TEXT,
    "tag" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgMensagem_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgFluxo" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "igAccountId" TEXT,
    "nome" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "triggerType" TEXT NOT NULL,
    "triggerConfig" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgFluxo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgFluxoNo" (
    "id" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "tipo" TEXT NOT NULL,
    "config" JSONB NOT NULL DEFAULT '{}',
    "posX" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "posY" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "nextIds" TEXT[] DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "IgFluxoNo_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgFluxoExecucao" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "fluxoId" TEXT NOT NULL,
    "contatoId" TEXT NOT NULL,
    "noAtualId" TEXT,
    "status" TEXT NOT NULL DEFAULT 'RUNNING',
    "scheduledAt" TIMESTAMP(3),
    "context" JSONB NOT NULL DEFAULT '{}',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgFluxoExecucao_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "IgWebhookEvent" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT,
    "igUserId" TEXT,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IgWebhookEvent_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "Organization_slug_key" ON "Organization"("slug");
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");
CREATE UNIQUE INDEX "OrganizationMember_userId_organizationId_key" ON "OrganizationMember"("userId", "organizationId");
CREATE INDEX "OrganizationMember_organizationId_idx" ON "OrganizationMember"("organizationId");
CREATE UNIQUE INDEX "Subscription_organizationId_key" ON "Subscription"("organizationId");
CREATE UNIQUE INDEX "IgAccount_organizationId_igUserId_key" ON "IgAccount"("organizationId", "igUserId");
CREATE INDEX "IgAccount_igUserId_idx" ON "IgAccount"("igUserId");
CREATE UNIQUE INDEX "IgContato_igAccountId_igsid_key" ON "IgContato"("igAccountId", "igsid");
CREATE INDEX "IgContato_organizationId_idx" ON "IgContato"("organizationId");
CREATE INDEX "IgConversa_organizationId_lastMessageAt_idx" ON "IgConversa"("organizationId", "lastMessageAt");
CREATE INDEX "IgConversa_igAccountId_idx" ON "IgConversa"("igAccountId");
CREATE UNIQUE INDEX "IgMensagem_mid_key" ON "IgMensagem"("mid");
CREATE INDEX "IgMensagem_conversaId_createdAt_idx" ON "IgMensagem"("conversaId", "createdAt");
CREATE INDEX "IgFluxo_organizationId_status_idx" ON "IgFluxo"("organizationId", "status");
CREATE INDEX "IgFluxoNo_fluxoId_idx" ON "IgFluxoNo"("fluxoId");
CREATE INDEX "IgFluxoExecucao_status_scheduledAt_idx" ON "IgFluxoExecucao"("status", "scheduledAt");
CREATE INDEX "IgFluxoExecucao_organizationId_idx" ON "IgFluxoExecucao"("organizationId");
CREATE INDEX "IgWebhookEvent_processed_createdAt_idx" ON "IgWebhookEvent"("processed", "createdAt");
CREATE INDEX "IgWebhookEvent_igUserId_idx" ON "IgWebhookEvent"("igUserId");

ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "OrganizationMember" ADD CONSTRAINT "OrganizationMember_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgAccount" ADD CONSTRAINT "IgAccount_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgContato" ADD CONSTRAINT "IgContato_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgContato" ADD CONSTRAINT "IgContato_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgConversa" ADD CONSTRAINT "IgConversa_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgConversa" ADD CONSTRAINT "IgConversa_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgConversa" ADD CONSTRAINT "IgConversa_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "IgContato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgMensagem" ADD CONSTRAINT "IgMensagem_conversaId_fkey" FOREIGN KEY ("conversaId") REFERENCES "IgConversa"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgFluxo" ADD CONSTRAINT "IgFluxo_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgFluxo" ADD CONSTRAINT "IgFluxo_igAccountId_fkey" FOREIGN KEY ("igAccountId") REFERENCES "IgAccount"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "IgFluxoNo" ADD CONSTRAINT "IgFluxoNo_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "IgFluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgFluxoExecucao" ADD CONSTRAINT "IgFluxoExecucao_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgFluxoExecucao" ADD CONSTRAINT "IgFluxoExecucao_fluxoId_fkey" FOREIGN KEY ("fluxoId") REFERENCES "IgFluxo"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgFluxoExecucao" ADD CONSTRAINT "IgFluxoExecucao_contatoId_fkey" FOREIGN KEY ("contatoId") REFERENCES "IgContato"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "IgWebhookEvent" ADD CONSTRAINT "IgWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
