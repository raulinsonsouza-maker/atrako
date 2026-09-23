import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { purgeLogs } from "@/lib/logger";
import { requireInternalAdmin } from "@/lib/internalAccess";
import { writeAuditLog } from "@/lib/internalUsers";

export async function GET(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  const { searchParams } = request.nextUrl;
  const level = searchParams.get("level"); // INFO | WARN | ERROR | null = todos
  const limit = Math.min(Number(searchParams.get("limit") ?? "300"), 500);

  // Purge entradas antigas (fire-and-forget, não bloqueia resposta)
  purgeLogs(7).catch(() => {});

  const where = level && ["INFO", "WARN", "ERROR"].includes(level)
    ? { level }
    : {};

  const logs = await prisma.syncLog.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: limit,
    select: {
      id: true,
      level: true,
      message: true,
      context: true,
      createdAt: true,
    },
  });

  return NextResponse.json({ logs });
}

export async function DELETE(request: NextRequest) {
  const access = await requireInternalAdmin();
  if (access.response) return access.response;

  await prisma.syncLog.deleteMany({});
  await writeAuditLog({
    action: "SYNC_LOGS_PURGED",
    actorInternalUserId: access.user.id,
    metadata: { operationType: "purge" },
  });
  return NextResponse.json({ ok: true });
}
