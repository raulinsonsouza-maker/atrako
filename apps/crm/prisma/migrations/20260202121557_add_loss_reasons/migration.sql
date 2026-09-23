-- AlterTable
ALTER TABLE "Lead" ADD COLUMN     "lossReasonId" TEXT;

-- AlterTable
ALTER TABLE "Opportunity" ADD COLUMN     "lossReasonId" TEXT;

-- CreateTable
CREATE TABLE "LossReason" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "LossReason_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "LossReason_tenantId_idx" ON "LossReason"("tenantId");

-- CreateIndex
CREATE INDEX "LossReason_tenantId_order_idx" ON "LossReason"("tenantId", "order");

-- CreateIndex
CREATE UNIQUE INDEX "LossReason_tenantId_name_key" ON "LossReason"("tenantId", "name");

-- AddForeignKey
ALTER TABLE "Lead" ADD CONSTRAINT "Lead_lossReasonId_fkey" FOREIGN KEY ("lossReasonId") REFERENCES "LossReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Opportunity" ADD CONSTRAINT "Opportunity_lossReasonId_fkey" FOREIGN KEY ("lossReasonId") REFERENCES "LossReason"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LossReason" ADD CONSTRAINT "LossReason_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
