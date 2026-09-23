import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";

/**
 * Health check: verifica se o banco está acessível.
 * GET /api/health
 */
export async function GET() {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return NextResponse.json({ ok: true, db: "connected" });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    console.error("[api/health] Erro DB:", e);
    return NextResponse.json(
      { ok: false, db: "error", error: message },
      { status: 503 }
    );
  }
}
