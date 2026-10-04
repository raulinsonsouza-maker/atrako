import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { parseUnsubscribeToken } from "@/lib/flows/tracking";
import { exitEnrollments } from "@/lib/flows/engine";
import { getPublicOrigin } from "@/lib/http/public-origin";

/**
 * POST do formulário de /u/{token} e alvo RFC 8058 (List-Unsubscribe-Post: One-Click).
 * GET nunca descadastra (antivírus abrem links).
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const parsed = parseUnsubscribeToken(token);
  if (!parsed) return NextResponse.json({ error: "invalid token" }, { status: 400 });

  const contact = await prisma.nativeContact.findFirst({
    where: { id: parsed.contactId, clienteId: parsed.clienteId },
    select: { id: true, emailOptOutAt: true },
  });
  if (!contact) return NextResponse.json({ error: "not found" }, { status: 404 });

  const ct = request.headers.get("content-type") ?? "";
  let alsoWhatsApp = false;
  let oneClick = false;
  if (ct.includes("form")) {
    const form = await request.formData().catch(() => null);
    alsoWhatsApp = form?.get("whatsapp") === "1";
    oneClick = form?.get("List-Unsubscribe") === "One-Click";
  }

  const now = new Date();
  await prisma.nativeContact.update({
    where: { id: contact.id },
    data: {
      emailOptOutAt: contact.emailOptOutAt ?? now,
      ...(alsoWhatsApp ? { waOptOutAt: now } : {}),
    },
  });
  await prisma.messageEvent.create({
    data: {
      clienteId: parsed.clienteId,
      contactId: contact.id,
      type: "unsubscribed",
      meta: { channel: alsoWhatsApp ? "all" : "email", oneClick },
    },
  });
  await exitEnrollments({
    clienteId: parsed.clienteId,
    contactId: contact.id,
    reason: "unsubscribed",
    channel: alsoWhatsApp ? undefined : "EMAIL",
  });

  if (oneClick) return new NextResponse(null, { status: 200 });
  return NextResponse.redirect(`${getPublicOrigin(request)}/u/${token}?done=1`, 303);
}
