-- CreateTable
CREATE TABLE "AtrakoLlmCooldown" (
    "key" VARCHAR(200) NOT NULL,
    "until" TIMESTAMP(3) NOT NULL,
    "status" INTEGER,
    "reason" VARCHAR(160),
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AtrakoLlmCooldown_pkey" PRIMARY KEY ("key")
);
