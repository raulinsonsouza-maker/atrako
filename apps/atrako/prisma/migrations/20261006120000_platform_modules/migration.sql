-- CreateTable
CREATE TABLE "PlatformModule" (
    "key" VARCHAR(40) NOT NULL,
    "release" VARCHAR(16) NOT NULL DEFAULT 'AVAILABLE',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlatformModule_pkey" PRIMARY KEY ("key")
);

-- Releases iniciais: Instagram oculto, Agenda e Loja em beta.
INSERT INTO "PlatformModule" ("key", "release", "updatedAt") VALUES
    ('social', 'HIDDEN', CURRENT_TIMESTAMP),
    ('agenda', 'BETA', CURRENT_TIMESTAMP),
    ('commerce', 'BETA', CURRENT_TIMESTAMP)
ON CONFLICT ("key") DO NOTHING;

-- modulesEnabled passa a guardar só escolhas explícitas.
ALTER TABLE "WorkspaceSettings" ALTER COLUMN "modulesEnabled" SET DEFAULT '{}';

-- O default antigo gravava tudo `true` (indistinguível de escolha); só `false` foi escolha do dono.
UPDATE "WorkspaceSettings"
SET "modulesEnabled" = COALESCE(
    (
        SELECT jsonb_object_agg(e.key, e.value)
        FROM jsonb_each("modulesEnabled"::jsonb) AS e
        WHERE e.value = 'false'::jsonb
    ),
    '{}'::jsonb
);

-- Quem já usa Agenda/Loja mantém ligado (escolha explícita vence o BETA).
UPDATE "WorkspaceSettings" ws
SET "modulesEnabled" = ws."modulesEnabled"::jsonb || '{"agenda": true}'::jsonb
WHERE NOT (ws."modulesEnabled"::jsonb ? 'agenda')
  AND (
    EXISTS (SELECT 1 FROM "AgendaService" s WHERE s."clienteId" = ws."clienteId")
    OR EXISTS (SELECT 1 FROM "AgendaBooking" b WHERE b."clienteId" = ws."clienteId")
  );

UPDATE "WorkspaceSettings" ws
SET "modulesEnabled" = ws."modulesEnabled"::jsonb || '{"commerce": true}'::jsonb
WHERE NOT (ws."modulesEnabled"::jsonb ? 'commerce')
  AND (
    EXISTS (SELECT 1 FROM "CommerceOrder" o WHERE o."clienteId" = ws."clienteId")
    OR EXISTS (
      SELECT 1 FROM "CommerceProduct" p
      WHERE p."clienteId" = ws."clienteId" AND p."priceCents" > 0 AND p."status" = 'PUBLISHED'
    )
  );
