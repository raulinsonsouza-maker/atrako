-- AlterTable
ALTER TABLE "IgAccount" ALTER COLUMN "pageId" DROP NOT NULL;

-- RenameColumn
ALTER TABLE "IgAccount" RENAME COLUMN "pageAccessToken" TO "accessToken";

-- AlterTable
ALTER TABLE "IgAccount" ADD COLUMN IF NOT EXISTS "scopes" TEXT;
