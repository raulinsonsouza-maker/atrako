-- LinkedIn Ads integration (idempotent: ConexaoIntegracao pode ainda não existir nesta ordem)
DO $$
BEGIN
  IF to_regclass('"ConexaoIntegracao"') IS NOT NULL THEN
    ALTER TABLE "ConexaoIntegracao"
      ADD COLUMN IF NOT EXISTS "linkedinAccessToken" TEXT,
      ADD COLUMN IF NOT EXISTS "linkedinRefreshToken" TEXT,
      ADD COLUMN IF NOT EXISTS "linkedinTokenExpiresAt" TIMESTAMP(3),
      ADD COLUMN IF NOT EXISTS "linkedinRefreshTokenExpiresAt" TIMESTAMP(3);
  END IF;
END $$;

CREATE TABLE IF NOT EXISTS "LinkedInAdsCampanha" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "contaId" TEXT,
  "campaignId" TEXT NOT NULL,
  "campaignName" TEXT NOT NULL,
  "campaignStatus" TEXT,
  "campaignType" TEXT,
  "data" DATE NOT NULL,
  "impressoes" INTEGER NOT NULL DEFAULT 0,
  "cliques" INTEGER NOT NULL DEFAULT 0,
  "custo" DECIMAL(14,2) NOT NULL DEFAULT 0,
  "conversoes" DOUBLE PRECISION NOT NULL DEFAULT 0,
  "leads" INTEGER NOT NULL DEFAULT 0,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LinkedInAdsCampanha_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "LinkedInAdsCampanha_clienteId_campaignId_data_key"
  ON "LinkedInAdsCampanha"("clienteId", "campaignId", "data");
CREATE INDEX IF NOT EXISTS "LinkedInAdsCampanha_clienteId_data_idx"
  ON "LinkedInAdsCampanha"("clienteId", "data");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LinkedInAdsCampanha_clienteId_fkey'
  ) THEN
    ALTER TABLE "LinkedInAdsCampanha"
      ADD CONSTRAINT "LinkedInAdsCampanha_clienteId_fkey"
      FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'LinkedInAdsCampanha_contaId_fkey'
  ) THEN
    ALTER TABLE "LinkedInAdsCampanha"
      ADD CONSTRAINT "LinkedInAdsCampanha_contaId_fkey"
      FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
