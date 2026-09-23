import { prisma } from "@/lib/db";

interface PendingOutboxRow {
  id: string;
  eventId: string;
  topic: string;
  payload: unknown;
  attempts: number;
}

function getOutboxUrl(): string | null {
  return process.env.ATRAKO_OUTBOX_URL?.trim() || null;
}

export async function processAtrakoOutboxBatch(limit = 25): Promise<{
  processed: number;
  failed: number;
  skipped: boolean;
}> {
  const url = getOutboxUrl();
  if (!url) return { processed: 0, failed: 0, skipped: true };

  const rows = await prisma.$queryRaw<PendingOutboxRow[]>`
    SELECT "id", "eventId", "topic", "payload", "attempts"
    FROM "AtrakoOutbox"
    WHERE "publishedAt" IS NULL
      AND "failedAt" IS NULL
      AND "availableAt" <= NOW()
    ORDER BY "createdAt" ASC
    LIMIT ${limit}
  `;

  let processed = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          "content-type": "application/json",
          ...(process.env.ATRAKO_EVENTS_TOKEN
            ? { authorization: `Bearer ${process.env.ATRAKO_EVENTS_TOKEN}` }
            : {}),
        },
        body: JSON.stringify({
          eventId: row.eventId,
          topic: row.topic,
          payload: row.payload,
        }),
        signal: AbortSignal.timeout(10_000),
      });

      if (!response.ok) throw new Error(`Outbox target returned ${response.status}`);

      await prisma.$executeRaw`
        UPDATE "AtrakoOutbox"
        SET "publishedAt" = NOW(), "attempts" = "attempts" + 1
        WHERE "id" = ${row.id} AND "publishedAt" IS NULL
      `;
      processed++;
    } catch (error) {
      const nextAttempts = row.attempts + 1;
      await prisma.$executeRaw`
        UPDATE "AtrakoOutbox"
        SET "attempts" = "attempts" + 1,
            "failedAt" = CASE WHEN "attempts" + 1 >= 5 THEN NOW() ELSE NULL END,
            "availableAt" = NOW() + INTERVAL '1 minute'
        WHERE "id" = ${row.id} AND "publishedAt" IS NULL
      `;
      failed++;
      console.error(
        `[atrako-outbox] failed event=${row.eventId} attempt=${nextAttempts}`,
        error instanceof Error ? error.message : error,
      );
    }
  }

  return { processed, failed, skipped: false };
}
