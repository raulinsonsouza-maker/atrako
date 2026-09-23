-- AlterTable
ALTER TABLE "User" ALTER COLUMN "passwordHash" DROP NOT NULL;

-- AlterTable
ALTER TABLE "User" ADD COLUMN IF NOT EXISTS "igUserId" TEXT;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_igUserId_key" ON "User"("igUserId");
