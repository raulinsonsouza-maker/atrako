-- CaptureForm: formulários publicados em /f/{slug}
CREATE TABLE IF NOT EXISTS "CaptureForm" (
  "id" TEXT NOT NULL,
  "clienteId" TEXT NOT NULL,
  "name" VARCHAR(200) NOT NULL,
  "slug" VARCHAR(120) NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'PUBLISHED',
  "steps" JSONB NOT NULL,
  "source" VARCHAR(64),
  "active" BOOLEAN NOT NULL DEFAULT true,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "CaptureForm_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "CaptureForm_clienteId_slug_key" ON "CaptureForm"("clienteId", "slug");
CREATE INDEX IF NOT EXISTS "CaptureForm_clienteId_status_idx" ON "CaptureForm"("clienteId", "status");
CREATE INDEX IF NOT EXISTS "CaptureForm_slug_idx" ON "CaptureForm"("slug");

DO $$ BEGIN
  ALTER TABLE "CaptureForm"
    ADD CONSTRAINT "CaptureForm_clienteId_fkey"
    FOREIGN KEY ("clienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
