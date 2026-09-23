-- CreateEnum
CREATE TYPE "AutomationTrigger" AS ENUM ('LEAD_CREATED', 'LEAD_STAGE_CHANGED', 'LEAD_STATUS_CHANGED', 'LEAD_ASSIGNED', 'LEAD_NO_REPLY', 'TASK_OVERDUE', 'OPPORTUNITY_CREATED', 'OPPORTUNITY_WON', 'OPPORTUNITY_LOST');

-- CreateTable
CREATE TABLE "AutomationRule" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "name" VARCHAR(255) NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT true,
    "trigger" "AutomationTrigger" NOT NULL,
    "triggerConfig" JSONB,
    "actions" JSONB NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AutomationRule_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_idx" ON "AutomationRule"("tenantId");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_enabled_idx" ON "AutomationRule"("tenantId", "enabled");

-- CreateIndex
CREATE INDEX "AutomationRule_tenantId_trigger_idx" ON "AutomationRule"("tenantId", "trigger");

-- AddForeignKey
ALTER TABLE "AutomationRule" ADD CONSTRAINT "AutomationRule_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;
