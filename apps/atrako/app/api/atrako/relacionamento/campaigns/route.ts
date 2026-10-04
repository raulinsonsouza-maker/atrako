import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, flowActor, gate, readBody, str } from "@/lib/flows/api";
import { CAMPAIGN_STATUS_LABELS } from "@/lib/flows/campaigns";
import { upcomingDates } from "@/lib/flows/calendar";

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const [rows, members, dates, perf] = await Promise.all([
    prisma.messageCampaign.findMany({
      where: { clienteId: ws },
      orderBy: [{ eventDate: "asc" }, { createdAt: "desc" }],
      take: 200,
      select: {
        id: true,
        name: true,
        channel: true,
        status: true,
        eventDate: true,
        scheduledAt: true,
        sentAt: true,
        calendarKey: true,
        ownerMemberId: true,
        approverMemberId: true,
        recipientsCount: true,
        couponCode: true,
        updatedAt: true,
      },
    }),
    prisma.workspaceMember.findMany({
      where: { clienteId: ws, active: true },
      select: { id: true, name: true, email: true, role: true },
      orderBy: { name: "asc" },
    }),
    upcomingDates(ws, { days: 120 }),
    prisma.messageDelivery.groupBy({
      by: ["campaignId"],
      where: { clienteId: ws, isTest: false, campaignId: { not: null } },
      _count: { _all: true, sentAt: true, openedAt: true, clickedAt: true, convertedAt: true },
      _sum: { convertedCents: true, costMicros: true },
    }),
  ]);
  const names = new Map(members.map((m) => [m.id, m.name || m.email]));
  const perfBy = new Map(perf.map((p) => [p.campaignId, p]));
  return NextResponse.json({
    campaigns: rows.map((c) => ({
      ...c,
      statusLabel: CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? c.status,
      ownerName: c.ownerMemberId ? names.get(c.ownerMemberId) ?? null : null,
      approverName: c.approverMemberId ? names.get(c.approverMemberId) ?? null : null,
      stats: (() => {
        const p = perfBy.get(c.id);
        return p
          ? {
              sent: p._count.sentAt,
              opened: p._count.openedAt,
              clicked: p._count.clickedAt,
              converted: p._count.convertedAt,
              cents: p._sum.convertedCents ?? 0,
              costMicros: p._sum.costMicros ?? 0,
            }
          : null;
      })(),
    })),
    members,
    upcoming: dates.map((d) => ({
      key: d.key,
      label: d.label,
      date: d.date.toISOString(),
      leadDays: d.leadDays,
      hint: d.hint ?? null,
      custom: d.custom ?? false,
      campaignId: rows.find((c) => c.calendarKey === d.key)?.id ?? null,
    })),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const actor = await flowActor(ws);
  const name = str(body.name).slice(0, 200);
  if (!name) return bad("Dê um nome à campanha");
  const channel = ["EMAIL", "WHATSAPP", "BOTH"].includes(str(body.channel)) ? str(body.channel) : "EMAIL";
  const eventDate = str(body.eventDate) ? new Date(str(body.eventDate)) : null;
  const calendarKey = str(body.calendarKey) || null;
  try {
    const c = await prisma.messageCampaign.create({
      data: {
        clienteId: ws,
        name,
        channel,
        status: "IDEIA",
        eventDate: eventDate && !Number.isNaN(eventDate.getTime()) ? eventDate : null,
        calendarKey,
        ownerMemberId: actor.memberId,
        audience: { lifecycles: ["NOVO", "RECORRENTE", "VIP", "EM_RISCO"] } as Prisma.InputJsonValue,
        content: {
          email: {
            subject: name,
            preheader: "",
            blocks: [
              { type: "heading", text: name },
              { type: "text", text: "Olá {{primeiro_nome}}," },
              { type: "recommendations", title: "Selecionamos para você", limit: 4 },
              { type: "button", label: "Ver na loja" },
              { type: "signature" },
            ],
          },
        } as Prisma.InputJsonValue,
      },
    });
    await prisma.messageCampaignComment.create({
      data: { campaignId: c.id, memberId: actor.memberId, authorName: actor.name, kind: "SISTEMA", body: "Campanha criada" },
    });
    return NextResponse.json({ ok: true, id: c.id });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return bad("Já existe uma campanha para esta data");
    throw err;
  }
}
