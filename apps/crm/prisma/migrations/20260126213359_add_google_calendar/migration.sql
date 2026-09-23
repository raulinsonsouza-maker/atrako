-- AlterTable
ALTER TABLE "Activity" ADD COLUMN     "endAt" TIMESTAMP(3),
ADD COLUMN     "startAt" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "UserCalendarConnection" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "calendarId" VARCHAR(255) NOT NULL,
    "accessToken" TEXT,
    "refreshToken" TEXT,
    "tokenExpiresAt" TIMESTAMP(3),
    "syncToken" TEXT,
    "channelId" VARCHAR(255),
    "resourceId" VARCHAR(255),
    "channelExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserCalendarConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CalendarEventLink" (
    "id" TEXT NOT NULL,
    "tenantId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "calendarId" VARCHAR(255) NOT NULL,
    "googleEventId" VARCHAR(255) NOT NULL,
    "status" VARCHAR(20),
    "lastSyncedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CalendarEventLink_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "UserCalendarConnection_userId_key" ON "UserCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "UserCalendarConnection_tenantId_idx" ON "UserCalendarConnection"("tenantId");

-- CreateIndex
CREATE INDEX "UserCalendarConnection_userId_idx" ON "UserCalendarConnection"("userId");

-- CreateIndex
CREATE INDEX "CalendarEventLink_tenantId_idx" ON "CalendarEventLink"("tenantId");

-- CreateIndex
CREATE INDEX "CalendarEventLink_userId_idx" ON "CalendarEventLink"("userId");

-- CreateIndex
CREATE INDEX "CalendarEventLink_googleEventId_idx" ON "CalendarEventLink"("googleEventId");

-- CreateIndex
CREATE UNIQUE INDEX "CalendarEventLink_tenantId_activityId_key" ON "CalendarEventLink"("tenantId", "activityId");

-- AddForeignKey
ALTER TABLE "UserCalendarConnection" ADD CONSTRAINT "UserCalendarConnection_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserCalendarConnection" ADD CONSTRAINT "UserCalendarConnection_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_tenantId_fkey" FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CalendarEventLink" ADD CONSTRAINT "CalendarEventLink_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "Activity"("id") ON DELETE CASCADE ON UPDATE CASCADE;
