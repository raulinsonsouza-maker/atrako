-- CreateTable
CREATE TABLE "MetaLeadIndividual" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contaId" TEXT,
    "metaLeadId" TEXT NOT NULL,
    "formId" TEXT NOT NULL,
    "formName" TEXT,
    "campaignId" TEXT,
    "campaignName" TEXT,
    "createdTime" TIMESTAMP(3) NOT NULL,
    "nomeEmpresa" TEXT,
    "telefone" TEXT,
    "estado" TEXT,
    "tipoEmpresa" TEXT,
    "faixaFaturamento" TEXT,
    "emailLead" TEXT,
    "statusCrm" TEXT,
    "rawFieldData" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "MetaLeadIndividual_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "MetaLeadIndividual_clienteId_metaLeadId_key" ON "MetaLeadIndividual"("clienteId", "metaLeadId");

-- CreateIndex
CREATE INDEX "MetaLeadIndividual_clienteId_createdTime_idx" ON "MetaLeadIndividual"("clienteId", "createdTime");

-- CreateIndex
CREATE INDEX "MetaLeadIndividual_clienteId_estado_idx" ON "MetaLeadIndividual"("clienteId", "estado");

-- AddForeignKey
ALTER TABLE "MetaLeadIndividual" ADD CONSTRAINT "MetaLeadIndividual_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
