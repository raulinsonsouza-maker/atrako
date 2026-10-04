import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { previewDelivery } from "@/lib/flows/preview";
import { syncResendEmails } from "@/lib/flows/resend-sync";

export const maxDuration = 60;

const PAGE = 50;

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const sp = request.nextUrl.searchParams;

  // Detalhe de um envio (painel lateral)
  const id = sp.get("id");
  if (id) {
    const d = await prisma.messageDelivery.findFirst({
      where: { id, clienteId: ws },
      include: {
        events: { orderBy: { at: "asc" }, take: 100 },
        contact: { select: { id: true, name: true, email: true, phone: true, leads: { select: { id: true }, take: 1 } } },
      },
    });
    if (!d) return bad("Envio não encontrado", 404);
    const [preview, flow, campaign] = await Promise.all([
      previewDelivery(ws, d.id),
      d.flowId ? prisma.messageFlow.findUnique({ where: { id: d.flowId }, select: { name: true } }) : null,
      d.campaignId ? prisma.messageCampaign.findUnique({ where: { id: d.campaignId }, select: { name: true } }) : null,
    ]);
    const snap = (d.contentSnapshot ?? {}) as { destination?: string };
    return NextResponse.json({
      delivery: {
        ...d,
        contentSnapshot: undefined,
        destination: snap.destination ?? null,
        flowName: flow?.name ?? null,
        campaignName: campaign?.name ?? null,
        leadId: d.contact?.leads[0]?.id ?? null,
      },
      preview,
    });
  }

  // Supressão (descadastros, bounces, spam, opt-out WA)
  if (sp.get("view") === "suppression") {
    const kind = sp.get("kind") || "all";
    const or: Prisma.NativeContactWhereInput[] = [];
    if (kind === "all" || kind === "optout") or.push({ emailOptOutAt: { not: null } });
    if (kind === "all" || kind === "bounce") or.push({ emailBouncedAt: { not: null } });
    if (kind === "all" || kind === "complaint") or.push({ emailComplainedAt: { not: null } });
    if (kind === "all" || kind === "wa") or.push({ waOptOutAt: { not: null } }, { waMarketingOptOutAt: { not: null } });
    const q = str(sp.get("q"));
    const where: Prisma.NativeContactWhereInput = {
      clienteId: ws,
      OR: or,
      ...(q ? { AND: [{ OR: [{ email: { contains: q, mode: "insensitive" } }, { name: { contains: q, mode: "insensitive" } }, { phone: { contains: q } }] }] } : {}),
    };
    const [rows, total] = await Promise.all([
      prisma.nativeContact.findMany({
        where,
        orderBy: { updatedAt: "desc" },
        take: 200,
        select: {
          id: true,
          name: true,
          email: true,
          phone: true,
          emailOptOutAt: true,
          emailBouncedAt: true,
          emailComplainedAt: true,
          waOptOutAt: true,
          waMarketingOptOutAt: true,
        },
      }),
      prisma.nativeContact.count({ where }),
    ]);
    return NextResponse.json({ rows, total });
  }

  const page = Math.max(1, Number(sp.get("page")) || 1);
  const where: Prisma.MessageDeliveryWhereInput = { clienteId: ws };
  const channel = sp.get("channel");
  if (channel === "EMAIL" || channel === "WHATSAPP") where.channel = channel;
  const status = sp.get("status");
  if (status) where.status = status;
  const flowId = sp.get("flowId");
  if (flowId) where.flowId = flowId;
  const campaignId = sp.get("campaignId");
  if (campaignId) where.campaignId = campaignId;
  if (sp.get("tests") !== "1") where.isTest = false;
  const q = str(sp.get("q"));
  if (q) {
    where.OR = [
      { toAddress: { contains: q, mode: "insensitive" } },
      { subject: { contains: q, mode: "insensitive" } },
      { contact: { name: { contains: q, mode: "insensitive" } } },
    ];
  }
  const from = sp.get("from");
  const to = sp.get("to");
  if (from || to) {
    where.createdAt = {
      ...(from ? { gte: new Date(`${from}T00:00:00`) } : {}),
      ...(to ? { lte: new Date(`${to}T23:59:59`) } : {}),
    };
  }
  const [rows, total, flows, campaigns] = await Promise.all([
    prisma.messageDelivery.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE,
      take: PAGE,
      select: {
        id: true,
        channel: true,
        status: true,
        toAddress: true,
        subject: true,
        templateName: true,
        flowId: true,
        campaignId: true,
        sentAt: true,
        deliveredAt: true,
        openedAt: true,
        clickedAt: true,
        convertedAt: true,
        convertedCents: true,
        conversionKind: true,
        error: true,
        isTest: true,
        createdAt: true,
        contact: { select: { id: true, name: true } },
      },
    }),
    prisma.messageDelivery.count({ where }),
    prisma.messageFlow.findMany({ where: { clienteId: ws }, select: { id: true, name: true } }),
    prisma.messageCampaign.findMany({ where: { clienteId: ws }, select: { id: true, name: true }, take: 200 }),
  ]);
  const flowNames = new Map(flows.map((f) => [f.id, f.name]));
  const campaignNames = new Map(campaigns.map((c) => [c.id, c.name]));
  return NextResponse.json({
    rows: rows.map((r) => ({
      ...r,
      origin: r.flowId ? flowNames.get(r.flowId) ?? "Fluxo" : r.campaignId ? campaignNames.get(r.campaignId) ?? "Campanha" : "Avulso",
    })),
    total,
    page,
    pageSize: PAGE,
    flows,
    campaigns,
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const action = str(body.action);
  const g = await gate(request, action === "unsuppress" ? "manage" : "operate", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  if (action === "sync") {
    try {
      return NextResponse.json({ ok: true, ...(await syncResendEmails(ws)) });
    } catch (err) {
      return bad(err instanceof Error ? err.message : "Falha ao sincronizar");
    }
  }

  if (action === "unsuppress") {
    const contactId = str(body.contactId);
    const kind = str(body.kind);
    const data: Prisma.NativeContactUpdateManyMutationInput =
      kind === "optout"
        ? { emailOptOutAt: null }
        : kind === "bounce"
          ? { emailBouncedAt: null }
          : kind === "wa"
            ? { waOptOutAt: null, waMarketingOptOutAt: null }
            : {};
    // Reclamação de spam não pode ser revertida pela loja
    if (!Object.keys(data).length) return bad("Tipo inválido");
    const r = await prisma.nativeContact.updateMany({ where: { id: contactId, clienteId: ws }, data });
    return NextResponse.json({ ok: r.count > 0 });
  }

  return bad("Ação inválida");
}
