-- CreateTable
CREATE TABLE "IgFluxoPasta" (
    "id" TEXT NOT NULL,
    "organizationId" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IgFluxoPasta_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "IgFluxo" ADD COLUMN "pastaId" TEXT;

-- CreateIndex
CREATE INDEX "IgFluxoPasta_organizationId_idx" ON "IgFluxoPasta"("organizationId");

-- CreateIndex
CREATE INDEX "IgFluxo_pastaId_idx" ON "IgFluxo"("pastaId");

-- AddForeignKey
ALTER TABLE "IgFluxoPasta" ADD CONSTRAINT "IgFluxoPasta_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "IgFluxo" ADD CONSTRAINT "IgFluxo_pastaId_fkey" FOREIGN KEY ("pastaId") REFERENCES "IgFluxoPasta"("id") ON DELETE SET NULL ON UPDATE CASCADE;
