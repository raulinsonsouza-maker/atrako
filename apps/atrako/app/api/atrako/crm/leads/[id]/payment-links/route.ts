import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";
import { getInternalUser } from "@/lib/internalUsers";
import { validatePaymentLinkInput } from "@/lib/crm/payment-link-rules";
import {
  cancelPaymentLink,
  createPaymentLink,
  isMercadoPagoReady,
  listLeadPaymentLinks,
  renewPaymentLink,
} from "@/lib/crm/payment-links";
import { sendPaymentLink, type PaymentLinkChannel } from "@/lib/crm/payment-link-send";

type Ctx = { params: Promise<{ id: string }> };

function channelsFrom(raw: unknown): PaymentLinkChannel[] {
  const list = Array.isArray(raw) ? raw : [];
  return (["whatsapp", "email"] as const).filter((c) => list.includes(c));
}

async function actor() {
  const member = await getWorkspaceMember();
  if (member) return { id: member.id, name: member.name || member.email, email: member.email };
  const user = await getInternalUser();
  return { id: user?.id ?? null, name: user?.username ?? null, email: user?.email ?? null };
}

async function leadContact(workspaceId: string, leadId: string) {
  return prisma.nativeLead.findFirst({
    where: { id: leadId, clienteId: workspaceId },
    select: { id: true, dealValue: true, contact: { select: { email: true, phone: true, phoneE164: true } } },
  });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await gate(request, "operate");
  if (!g.ok) return g.response;
  const lead = await leadContact(g.workspaceId, id);
  if (!lead) return bad("Lead não encontrado", 404);
  const [links, mpReady] = await Promise.all([
    listLeadPaymentLinks(g.workspaceId, id),
    isMercadoPagoReady(g.workspaceId),
  ]);
  return NextResponse.json({
    links,
    mpReady,
    contact: {
      hasEmail: Boolean(lead.contact?.email),
      hasPhone: Boolean(lead.contact?.phoneE164 || lead.contact?.phone),
    },
    dealValue: lead.dealValue != null ? Number(lead.dealValue) : null,
  });
}

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;

  const parsed = validatePaymentLinkInput(body);
  if (!parsed.ok) return bad(parsed.error);
  const who = await actor();
  const created = await createPaymentLink({
    ...parsed.value,
    workspaceId: g.workspaceId,
    leadId: id,
    createdById: who.id,
    createdByName: who.name,
  });
  if (!created.ok) return bad(created.error, created.status);

  const channels = channelsFrom(body.channels);
  const sent = channels.length
    ? await sendPaymentLink({ workspaceId: g.workspaceId, linkId: created.link.id, channels, replyTo: who.email })
    : null;
  const links = await listLeadPaymentLinks(g.workspaceId, id);
  return NextResponse.json({
    ok: true,
    link: links.find((l) => l.id === created.link.id) ?? null,
    results: sent && sent.ok ? sent.results : {},
    links,
  });
}

export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const linkId = str(body.linkId);
  const link = await prisma.leadPaymentLink.findFirst({
    where: { id: linkId, clienteId: g.workspaceId, leadId: id },
    select: { id: true },
  });
  if (!link) return bad("Link não encontrado", 404);

  const action = str(body.action);
  if (action === "cancel") {
    if (!(await cancelPaymentLink(g.workspaceId, link.id))) return bad("Só links pendentes podem ser cancelados.");
    return NextResponse.json({ ok: true, links: await listLeadPaymentLinks(g.workspaceId, id) });
  }
  if (action === "resend") {
    const channels = channelsFrom(body.channels);
    if (!channels.length) return bad("Escolha WhatsApp ou e-mail.");
    if (!(await renewPaymentLink(g.workspaceId, link.id))) return bad("Este link já foi pago ou cancelado.");
    const who = await actor();
    const sent = await sendPaymentLink({ workspaceId: g.workspaceId, linkId: link.id, channels, replyTo: who.email });
    return NextResponse.json({
      ok: true,
      results: sent.ok ? sent.results : {},
      links: await listLeadPaymentLinks(g.workspaceId, id),
    });
  }
  return bad("Ação inválida");
}
