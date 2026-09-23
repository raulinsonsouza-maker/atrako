import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import {
  markRewardLinkClicked,
  parseLinkTrackingToken,
} from "@/lib/symbius/linkTracking";

function withLeadId(destination: string, stId: string): string {
  try {
    const url = new URL(destination);
    if (!url.searchParams.has("symbius_lead_id")) {
      url.searchParams.set("symbius_lead_id", stId);
    }
    return url.toString();
  } catch {
    const sep = destination.includes("?") ? "&" : "?";
    return `${destination}${sep}symbius_lead_id=${encodeURIComponent(stId)}`;
  }
}

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const payload = parseLinkTrackingToken(token);

  if (!payload) {
    return NextResponse.json({ error: "Link inválido ou expirado" }, { status: 400 });
  }

  try {
    await markRewardLinkClicked({
      reminderExecId: payload.e,
      contatoId: payload.c,
      fluxoId: payload.f,
    });
  } catch (e) {
    console.warn("[symbius/go] click tracking failed:", e);
  }

  let dest = payload.u;
  try {
    const contato = await prisma.igContato.findUnique({
      where: { id: payload.c },
      select: {
        trackingIdentityId: true,
        organizationId: true,
        igsid: true,
        nome: true,
        username: true,
        phone: true,
        trackingIdentity: { select: { stId: true } },
      },
    });
    if (contato) {
      let stId = contato.trackingIdentity?.stId;
      if (!stId) {
        const { ensureIgContatoIdentity } = await import(
          "@/lib/symbius/attribution/identify"
        );
        const identity = await ensureIgContatoIdentity({
          organizationId: contato.organizationId,
          contatoId: payload.c,
          igsid: contato.igsid,
          name: contato.nome ?? contato.username,
          phone: contato.phone,
        });
        stId = identity.stId;
      }
      if (stId) dest = withLeadId(dest, stId);
    }
  } catch (e) {
    console.warn("[symbius/go] st_id append failed:", e);
  }

  return NextResponse.redirect(dest, 302);
}
