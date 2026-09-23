import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { triggerManualFluxo } from "@/lib/symbius/manualFluxo";

const schema = z.object({ fluxoId: z.string().min(1) });

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const { id } = await params;
  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "fluxoId obrigatório" }, { status: 400 });
  }

  const ok = await triggerManualFluxo({
    organizationId: session.organizationId,
    fluxoId: parsed.data.fluxoId,
    contatoId: id,
    context: { manual: true, triggeredBy: session.userId },
  });

  if (!ok) {
    return NextResponse.json({ error: "Fluxo ou contato inválido" }, { status: 400 });
  }

  return NextResponse.json({ ok: true });
}
