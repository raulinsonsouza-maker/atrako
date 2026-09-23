import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { mergeIdentities } from "@/lib/symbius/attribution/identify";

const schema = z.object({
  keepStId: z.string().min(1),
  absorbStId: z.string().min(1),
});

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const { prisma } = await import("@/lib/db");
  const keep = await prisma.trackingIdentity.findFirst({
    where: {
      organizationId: session.organizationId,
      stId: parsed.data.keepStId,
    },
  });
  const absorb = await prisma.trackingIdentity.findFirst({
    where: {
      organizationId: session.organizationId,
      stId: parsed.data.absorbStId,
    },
  });
  if (!keep || !absorb) {
    return NextResponse.json({ error: "Identity não encontrada" }, { status: 404 });
  }

  await mergeIdentities(session.organizationId, keep.id, absorb.id);
  return NextResponse.json({ ok: true, st_id: keep.stId });
}
