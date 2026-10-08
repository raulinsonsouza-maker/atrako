-- Biblioteca de seções de landing page (curadoria cross-workspace).

CREATE TABLE "LpLibrarySection" (
    "id" TEXT NOT NULL,
    "kind" VARCHAR(40) NOT NULL,
    "goal" VARCHAR(20),
    "html" TEXT NOT NULL,
    "css" TEXT NOT NULL,
    "baseCss" TEXT,
    "fx" TEXT[],
    "tags" TEXT[],
    "status" VARCHAR(20) NOT NULL DEFAULT 'candidate',
    "score" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "uses" INTEGER NOT NULL DEFAULT 0,
    "skeleton" VARCHAR(40) NOT NULL,
    "sourceClienteId" TEXT NOT NULL,
    "sourceProductId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LpLibrarySection_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "LpLibraryUse" (
    "id" TEXT NOT NULL,
    "sectionId" TEXT NOT NULL,
    "clienteId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LpLibraryUse_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LpLibrarySection_skeleton_key" ON "LpLibrarySection"("skeleton");
CREATE INDEX "LpLibrarySection_status_kind_goal_idx" ON "LpLibrarySection"("status", "kind", "goal");
CREATE INDEX "LpLibraryUse_sectionId_idx" ON "LpLibraryUse"("sectionId");
CREATE INDEX "LpLibraryUse_productId_idx" ON "LpLibraryUse"("productId");

ALTER TABLE "LpLibrarySection" ADD CONSTRAINT "LpLibrarySection_sourceClienteId_fkey" FOREIGN KEY ("sourceClienteId") REFERENCES "Cliente"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "LpLibraryUse" ADD CONSTRAINT "LpLibraryUse_sectionId_fkey" FOREIGN KEY ("sectionId") REFERENCES "LpLibrarySection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
