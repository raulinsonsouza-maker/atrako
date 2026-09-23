-- Bounded, hashed login-attempt buckets. No client IP or username is stored.
CREATE TABLE "LoginThrottle" (
  "id" TEXT NOT NULL,
  "bucketKeyHash" TEXT NOT NULL,
  "windowStartedAt" TIMESTAMP(3) NOT NULL,
  "attemptCount" INTEGER NOT NULL DEFAULT 0,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "LoginThrottle_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "LoginThrottle_bucketKeyHash_key" ON "LoginThrottle"("bucketKeyHash");
CREATE INDEX "LoginThrottle_windowStartedAt_idx" ON "LoginThrottle"("windowStartedAt");