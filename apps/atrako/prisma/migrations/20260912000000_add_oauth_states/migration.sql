CREATE TABLE "OAuthState" (
    "id" TEXT NOT NULL,
    "stateDigest" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "consumedAt" TIMESTAMP(3),
    "provider" VARCHAR(32) NOT NULL,
    "clienteId" TEXT NOT NULL,
    "initiatedByInternalUserId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OAuthState_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "OAuthState_stateDigest_key" ON "OAuthState"("stateDigest");
CREATE INDEX "OAuthState_expiresAt_idx" ON "OAuthState"("expiresAt");
CREATE INDEX "OAuthState_provider_clienteId_idx" ON "OAuthState"("provider", "clienteId");

ALTER TABLE "OAuthState"
  ADD CONSTRAINT "OAuthState_clienteId_fkey"
  FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id")
  ON DELETE CASCADE ON UPDATE CASCADE,
  ADD CONSTRAINT "OAuthState_initiatedByInternalUserId_fkey"
  FOREIGN KEY ("initiatedByInternalUserId") REFERENCES "InternalUser"("id")
  ON DELETE CASCADE ON UPDATE CASCADE;