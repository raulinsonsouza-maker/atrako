-- Preferências do CRM nativo por workspace (motivos de perda, etc.)
ALTER TABLE "WorkspaceSettings" ADD COLUMN IF NOT EXISTS "crmPrefs" JSONB NOT NULL DEFAULT '{}';
