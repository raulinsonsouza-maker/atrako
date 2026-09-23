-- Additive local authentication migration.
-- Legacy Clerk identifiers and email values are intentionally retained for
-- audit/data preservation; neither is used to authenticate local users.
ALTER TABLE "InternalUser"
  ALTER COLUMN "email" DROP NOT NULL,
  ADD COLUMN "username" TEXT,
  ADD COLUMN "passwordHash" TEXT,
  ADD COLUMN "mustChangePassword" BOOLEAN NOT NULL DEFAULT false,
  ADD COLUMN "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN "failureWindowStartedAt" TIMESTAMP(3),
  ADD COLUMN "lockedUntil" TIMESTAMP(3),
  ADD COLUMN "passwordChangedAt" TIMESTAMP(3),
  ADD COLUMN "lastLoginAt" TIMESTAMP(3);

CREATE UNIQUE INDEX "InternalUser_username_key" ON "InternalUser"("username");
CREATE INDEX "InternalUser_username_active_idx" ON "InternalUser"("username", "active");

CREATE TABLE "InternalSession" (
  "id" TEXT NOT NULL,
  "tokenHash" TEXT NOT NULL,
  "userId" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "idleExpiresAt" TIMESTAMP(3) NOT NULL,
  "absoluteExpiresAt" TIMESTAMP(3) NOT NULL,
  "revokedAt" TIMESTAMP(3),
  CONSTRAINT "InternalSession_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "InternalSession_tokenHash_key" ON "InternalSession"("tokenHash");
CREATE INDEX "InternalSession_userId_revokedAt_idx" ON "InternalSession"("userId", "revokedAt");
CREATE INDEX "InternalSession_idleExpiresAt_idx" ON "InternalSession"("idleExpiresAt");
CREATE INDEX "InternalSession_absoluteExpiresAt_idx" ON "InternalSession"("absoluteExpiresAt");

ALTER TABLE "InternalSession"
  ADD CONSTRAINT "InternalSession_userId_fkey"
  FOREIGN KEY ("userId") REFERENCES "InternalUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "AuditLog"
  ADD COLUMN "actorInternalUserId" TEXT,
  ADD COLUMN "targetInternalUserId" TEXT;

CREATE INDEX "AuditLog_actorInternalUserId_createdAt_idx"
  ON "AuditLog"("actorInternalUserId", "createdAt");
CREATE INDEX "AuditLog_targetInternalUserId_createdAt_idx"
  ON "AuditLog"("targetInternalUserId", "createdAt");

ALTER TABLE "AuditLog"
  ADD CONSTRAINT "AuditLog_actorInternalUserId_fkey"
  FOREIGN KEY ("actorInternalUserId") REFERENCES "InternalUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE,
  ADD CONSTRAINT "AuditLog_targetInternalUserId_fkey"
  FOREIGN KEY ("targetInternalUserId") REFERENCES "InternalUser"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;