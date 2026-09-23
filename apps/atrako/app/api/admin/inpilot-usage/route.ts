import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireInternalAdmin } from "@/lib/internalAccess";

const WINDOW_DAYS = 30;

export async function GET() {
  const authz = await requireInternalAdmin();
  if (authz.response) return authz.response;

  const since = new Date(Date.now() - WINDOW_DAYS * 24 * 60 * 60 * 1000);
  type Aggregate = {
    clienteId: string;
    clienteNome: string;
    userId: string | null;
    userName: string | null;
    userEmail: string | null;
    requestVolume: number;
    successCount: number;
    errorCount: number;
    tokenTotal: number;
    estimatedCostMicros: number;
    latencyTotalMs: number;
    latencyCount: number;
  };
  type AggregateRow = Aggregate & { averageLatencyMs: number | null };
  // Aggregate in PostgreSQL so the bounded time window is complete even when
  // the message table is larger than an arbitrary application-side page.
  const grouped = await prisma.$queryRaw<AggregateRow[]>`
    SELECT
      c."id" AS "clienteId",
      c."nome" AS "clienteNome",
      u."id" AS "userId",
      u."name" AS "userName",
      u."email" AS "userEmail",
      COUNT(*) FILTER (WHERE m."role" = 'USER')::double precision AS "requestVolume",
      COUNT(*) FILTER (WHERE m."role" = 'ASSISTANT' AND m."status" = 'COMPLETE')::double precision AS "successCount",
      COUNT(*) FILTER (WHERE m."role" = 'ASSISTANT' AND m."status" = 'ERROR')::double precision AS "errorCount",
      COALESCE(SUM(m."totalTokens"), 0)::double precision AS "tokenTotal",
      COALESCE(SUM(m."estimatedCostMicros"), 0)::double precision AS "estimatedCostMicros",
      AVG(m."durationMs") FILTER (WHERE m."role" = 'ASSISTANT' AND m."durationMs" IS NOT NULL)::double precision AS "averageLatencyMs"
    FROM "AnalystMessage" m
    INNER JOIN "AnalystConversation" v ON v."id" = m."conversationId"
    INNER JOIN "Cliente" c ON c."id" = v."clienteId"
    LEFT JOIN "InternalUser" u ON u."id" = v."ownerUserId"
    WHERE m."createdAt" >= ${since}
    GROUP BY c."id", c."nome", u."id", u."name", u."email"
    ORDER BY "requestVolume" DESC, "clienteNome" ASC
  `;
  const rows = grouped.map((aggregate) => ({
    ...aggregate,
    requestVolume: Number(aggregate.requestVolume),
    successCount: Number(aggregate.successCount),
    errorCount: Number(aggregate.errorCount),
    tokenTotal: Number(aggregate.tokenTotal),
    estimatedCostMicros: Number(aggregate.estimatedCostMicros),
    averageLatencyMs: aggregate.averageLatencyMs == null ? null : Math.round(Number(aggregate.averageLatencyMs)),
    estimatedCost: Number(aggregate.estimatedCostMicros) / 1_000_000,
  }));

  return NextResponse.json({ since: since.toISOString(), windowDays: WINDOW_DAYS, rows });
}