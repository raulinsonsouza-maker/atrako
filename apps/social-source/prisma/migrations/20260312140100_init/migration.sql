-- CreateTable
CREATE TABLE "Cliente" (
    "id" TEXT NOT NULL,
    "nome" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "logoUrl" TEXT,
    "ativo" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Cliente_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "SheetsConfig" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "spreadsheetId" TEXT NOT NULL,
    "abaMetaRange" TEXT NOT NULL DEFAULT 'A:I',
    "abaGoogleRange" TEXT,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "SheetsConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Conta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "plataforma" TEXT NOT NULL,
    "accountIdPlataforma" TEXT,
    "nomeConta" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Conta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "FatoMidiaDiario" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "contaId" TEXT,
    "data" DATE NOT NULL,
    "canal" TEXT NOT NULL,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversoes" INTEGER NOT NULL DEFAULT 0,
    "investimento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "cpl" DECIMAL(14,2),
    "rawRowHash" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "FatoMidiaDiario_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgregadoMidiaSemanal" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "semanaIso" INTEGER NOT NULL,
    "investimento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgregadoMidiaSemanal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AgregadoMidiaMensal" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER NOT NULL,
    "investimento" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "impressoes" INTEGER NOT NULL DEFAULT 0,
    "cliques" INTEGER NOT NULL DEFAULT 0,
    "leads" INTEGER NOT NULL DEFAULT 0,
    "conversoes" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AgregadoMidiaMensal_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Meta" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "canal" TEXT,
    "tipoMeta" TEXT NOT NULL,
    "periodicidade" TEXT NOT NULL,
    "ano" INTEGER NOT NULL,
    "mes" INTEGER,
    "valorMeta" DECIMAL(14,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Meta_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PautaReuniao" (
    "id" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "semanaIso" INTEGER NOT NULL,
    "ano" INTEGER NOT NULL,
    "titulo" TEXT NOT NULL,
    "descricao" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ABERTA',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PautaReuniao_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Cliente_slug_key" ON "Cliente"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "SheetsConfig_clienteId_key" ON "SheetsConfig"("clienteId");

-- CreateIndex
CREATE INDEX "FatoMidiaDiario_clienteId_data_idx" ON "FatoMidiaDiario"("clienteId", "data");

-- CreateIndex
CREATE INDEX "FatoMidiaDiario_clienteId_canal_data_idx" ON "FatoMidiaDiario"("clienteId", "canal", "data");

-- CreateIndex
CREATE UNIQUE INDEX "FatoMidiaDiario_clienteId_data_canal_key" ON "FatoMidiaDiario"("clienteId", "data", "canal");

-- CreateIndex
CREATE INDEX "AgregadoMidiaSemanal_clienteId_ano_semanaIso_idx" ON "AgregadoMidiaSemanal"("clienteId", "ano", "semanaIso");

-- CreateIndex
CREATE UNIQUE INDEX "AgregadoMidiaSemanal_clienteId_canal_ano_semanaIso_key" ON "AgregadoMidiaSemanal"("clienteId", "canal", "ano", "semanaIso");

-- CreateIndex
CREATE INDEX "AgregadoMidiaMensal_clienteId_ano_mes_idx" ON "AgregadoMidiaMensal"("clienteId", "ano", "mes");

-- CreateIndex
CREATE UNIQUE INDEX "AgregadoMidiaMensal_clienteId_canal_ano_mes_key" ON "AgregadoMidiaMensal"("clienteId", "canal", "ano", "mes");

-- CreateIndex
CREATE INDEX "Meta_clienteId_idx" ON "Meta"("clienteId");

-- CreateIndex
CREATE INDEX "PautaReuniao_clienteId_ano_semanaIso_idx" ON "PautaReuniao"("clienteId", "ano", "semanaIso");

-- AddForeignKey
ALTER TABLE "SheetsConfig" ADD CONSTRAINT "SheetsConfig_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Conta" ADD CONSTRAINT "Conta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FatoMidiaDiario" ADD CONSTRAINT "FatoMidiaDiario_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "FatoMidiaDiario" ADD CONSTRAINT "FatoMidiaDiario_contaId_fkey" FOREIGN KEY ("contaId") REFERENCES "Conta"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgregadoMidiaSemanal" ADD CONSTRAINT "AgregadoMidiaSemanal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AgregadoMidiaMensal" ADD CONSTRAINT "AgregadoMidiaMensal_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Meta" ADD CONSTRAINT "Meta_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "PautaReuniao" ADD CONSTRAINT "PautaReuniao_clienteId_fkey" FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
