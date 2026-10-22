ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "comissaoMetaPercent" DECIMAL(5,2);
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "comissaoMetaInicio" DATE;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "comissaoMetaDiaCorte" INTEGER;
ALTER TABLE "Cliente" ADD COLUMN IF NOT EXISTS "comissaoMetaShareToken" VARCHAR(64);
CREATE UNIQUE INDEX IF NOT EXISTS "Cliente_comissaoMetaShareToken_key" ON "Cliente"("comissaoMetaShareToken");

CREATE TABLE IF NOT EXISTS "ComissaoVendasMetaCiclo" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "dataInicio" DATE NOT NULL,
  "dataFim" DATE NOT NULL,
  "comissaoPercent" DECIMAL(5,2) NOT NULL,
  "status" VARCHAR(16) NOT NULL DEFAULT 'EM_ANDAMENTO',
  "snapshot" JSONB,
  "fechadoEm" TIMESTAMP(3),
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "ComissaoVendasMetaCiclo_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "ComissaoVendasMetaCiclo_clienteId_dataInicio_key" ON "ComissaoVendasMetaCiclo"("clienteId", "dataInicio");
CREATE INDEX IF NOT EXISTS "ComissaoVendasMetaCiclo_clienteId_status_idx" ON "ComissaoVendasMetaCiclo"("clienteId", "status");

DO $$ BEGIN
  ALTER TABLE "ComissaoVendasMetaCiclo" ADD CONSTRAINT "ComissaoVendasMetaCiclo_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
