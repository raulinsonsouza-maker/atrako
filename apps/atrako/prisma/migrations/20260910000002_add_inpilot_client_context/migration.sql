ALTER TABLE "Cliente"
  ADD COLUMN "inPilotEnabled" BOOLEAN NOT NULL DEFAULT true,
  ADD COLUMN "produtoServico" VARCHAR(2000),
  ADD COLUMN "modeloNegocio" VARCHAR(2000),
  ADD COLUMN "publicoAlvo" VARCHAR(2000),
  ADD COLUMN "objetivoProjeto" VARCHAR(2000),
  ADD COLUMN "diferenciais" VARCHAR(2000),
  ADD COLUMN "observacoesAnaliticas" VARCHAR(2000);

ALTER TABLE "AnalystMessage"
  ADD COLUMN "durationMs" INTEGER;