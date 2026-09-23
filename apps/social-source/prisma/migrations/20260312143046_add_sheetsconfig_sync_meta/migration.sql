-- AlterTable
ALTER TABLE "SheetsConfig" ADD COLUMN     "lastSyncAt" TIMESTAMP(3),
ADD COLUMN     "lastSyncError" TEXT,
ADD COLUMN     "lastSyncRowsProcessed" INTEGER;
