-- CreateEnum
CREATE TYPE "InternalRole" AS ENUM ('ADMIN', 'ANALYST');

-- CreateTable
CREATE TABLE "InternalUser" (
    "id" TEXT NOT NULL,
    "clerkUserId" TEXT,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "role" "InternalRole" NOT NULL DEFAULT 'ANALYST',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "InternalUser_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL,
    "actorClerkUserId" TEXT,
    "targetClerkUserId" TEXT,
    "action" VARCHAR(80) NOT NULL,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "InternalUser_clerkUserId_key" ON "InternalUser"("clerkUserId");
CREATE UNIQUE INDEX "InternalUser_email_key" ON "InternalUser"("email");
CREATE INDEX "InternalUser_email_active_idx" ON "InternalUser"("email", "active");
CREATE INDEX "AuditLog_createdAt_idx" ON "AuditLog"("createdAt");
CREATE INDEX "AuditLog_actorClerkUserId_createdAt_idx" ON "AuditLog"("actorClerkUserId", "createdAt");
CREATE INDEX "AuditLog_targetClerkUserId_createdAt_idx" ON "AuditLog"("targetClerkUserId", "createdAt");