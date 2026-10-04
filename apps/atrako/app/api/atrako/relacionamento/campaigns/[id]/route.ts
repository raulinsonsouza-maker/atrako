import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, flowActor, gate, readBody, str } from "@/lib/flows/api";
import {
  CAMPAIGN_STATUS_LABELS,
  audienceCount,
  audienceSample,
  campaignChecklist,
  campaignResults,
  estimateCampaign,
  parseContent,
  sendCampaignTest,
  touchCampaignContent,
  transitionCampaign,
  type CampaignAction,
  type CampaignAudience,
  type CampaignBriefing,
} from "@/lib/flows/campaigns";
import { sanitizeEmailContent } from "@/lib/flows/render-email";
import { previewEmail } from "@/lib/flows/preview";
import { notify } from "@/lib/notifications";

export const maxDuration = 60;

type Ctx = { params: Promise<{ id: string }> };

async function load(ws: string, id: string) {
  return prisma.messageCampaign.findFirst({ where: { id, clienteId: ws } });
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const g = await gate(request);
  if (!g.ok) return g.response;
  const c = await load(g.workspaceId, id);
  if (!c) return bad("Campanha não encontrada", 404);
  const [checklist, estimate, comments, members, templates, sample, results, actor] = await Promise.all([
    campaignChecklist(c),
    estimateCampaign(g.workspaceId, c),
    prisma.messageCampaignComment.findMany({ where: { campaignId: c.id }, orderBy: { createdAt: "asc" }, take: 200 }),
    prisma.workspaceMember.findMany({
      where: { clienteId: g.workspaceId, active: true },
      select: { id: true, name: true, email: true, role: true },
    }),
    prisma.waTemplateRef.findMany({
      where: { clienteId: g.workspaceId, status: { notIn: ["DELETED", "PENDING_DELETION", "ARCHIVED"] } },
      select: { id: true, name: true, status: true, category: true, purpose: true, components: true },
      orderBy: { updatedAt: "desc" },
      take: 100,
    }),
    audienceSample(g.workspaceId, c.audience as CampaignAudience, 10),
    ["ENVIANDO", "ENVIADA"].includes(c.status) ? campaignResults(c.id) : Promise.resolve(null),
    flowActor(g.workspaceId),
  ]);
  return NextResponse.json({
    campaign: {
      ...c,
      statusLabel: CAMPAIGN_STATUS_LABELS[c.status as keyof typeof CAMPAIGN_STATUS_LABELS] ?? c.status,
    },
    checklist,
    estimate,
    comments,
    members,
    templates,
    sample,
    results,
    canApprove: actor.platform || actor.role === "OWNER" || actor.role === "ADMIN",
    me: { memberId: actor.memberId, email: actor.email },
  });
}

/** Edição de campos (briefing, conteúdo, público, responsáveis, datas, cupom). */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const c = await load(g.workspaceId, id);
  if (!c) return bad("Campanha não encontrada", 404);
  if (["ENVIANDO", "ENVIADA"].includes(c.status)) return bad("Campanha já saiu — não pode ser editada");

  const data: Prisma.MessageCampaignUpdateInput = {};
  let contentChanged = false;
  if (typeof body.name === "string" && body.name.trim()) data.name = body.name.trim().slice(0, 200);
  if (["EMAIL", "WHATSAPP", "BOTH"].includes(str(body.channel))) {
    data.channel = str(body.channel);
    contentChanged = contentChanged || str(body.channel) !== c.channel;
  }
  if (body.briefing && typeof body.briefing === "object") {
    data.briefing = { ...(c.briefing as object), ...(body.briefing as CampaignBriefing) } as Prisma.InputJsonValue;
  }
  if (body.audience && typeof body.audience === "object") {
    data.audience = body.audience as Prisma.InputJsonValue;
    // Público mudou: revisão precisa ser refeita
    data.checklist = { ...(c.checklist as object), audienceReviewed: false } as Prisma.InputJsonValue;
  }
  if (body.content && typeof body.content === "object") {
    const incoming = body.content as { email?: unknown; whatsapp?: unknown };
    const current = parseContent(c.content);
    data.content = {
      ...current,
      ...(incoming.email !== undefined ? { email: sanitizeEmailContent(incoming.email) } : {}),
      ...(incoming.whatsapp !== undefined ? { whatsapp: incoming.whatsapp } : {}),
    } as Prisma.InputJsonValue;
    contentChanged = true;
  }
  if (body.waTemplateRefId !== undefined) {
    const tid = str(body.waTemplateRefId);
    if (tid) {
      const t = await prisma.waTemplateRef.findFirst({ where: { id: tid, clienteId: g.workspaceId }, select: { id: true } });
      if (!t) return bad("Template não encontrado");
    }
    data.waTemplateRefId = tid || null;
    contentChanged = true;
  }
  if (body.couponCode !== undefined) {
    const code = str(body.couponCode).toUpperCase().replace(/[^A-Z0-9_-]/g, "").slice(0, 40);
    data.couponCode = code || null;
    if ((code || null) !== c.couponCode) {
      data.checklist = { ...((data.checklist as object) ?? (c.checklist as object)), couponConfirmed: false } as Prisma.InputJsonValue;
      contentChanged = true;
    }
  }
  if (body.checklist && typeof body.checklist === "object") {
    const ch = body.checklist as { couponConfirmed?: unknown; audienceReviewed?: unknown };
    data.checklist = {
      ...(c.checklist as object),
      ...((data.checklist as object) ?? {}),
      ...(typeof ch.couponConfirmed === "boolean" ? { couponConfirmed: ch.couponConfirmed } : {}),
      ...(typeof ch.audienceReviewed === "boolean" ? { audienceReviewed: ch.audienceReviewed } : {}),
    } as Prisma.InputJsonValue;
  }
  for (const k of ["ownerMemberId", "approverMemberId"] as const) {
    if (body[k] === undefined) continue;
    const mid = str(body[k]);
    if (mid) {
      const m = await prisma.workspaceMember.findFirst({ where: { id: mid, clienteId: g.workspaceId, active: true } });
      if (!m) return bad("Membro não encontrado");
    }
    data[k] = mid || null;
  }
  for (const k of ["eventDate", "scheduledAt"] as const) {
    if (body[k] === undefined) continue;
    const v = str(body[k]);
    const d = v ? new Date(v) : null;
    if (d && Number.isNaN(d.getTime())) return bad("Data inválida");
    if (k === "scheduledAt" && c.status === "AGENDADA") return bad("Desagende antes de mudar o horário");
    data[k] = d;
  }

  await prisma.messageCampaign.update({ where: { id: c.id }, data });
  if (contentChanged) await touchCampaignContent(c.id);

  const actor = await flowActor(g.workspaceId);
  for (const k of ["ownerMemberId", "approverMemberId"] as const) {
    const mid = data[k];
    if (typeof mid === "string" && mid !== c[k] && mid !== actor.memberId) {
      await notify({
        clienteId: g.workspaceId,
        memberId: mid,
        type: "campaign.assigned",
        title: `Você foi definido como ${k === "ownerMemberId" ? "responsável" : "aprovador"} de "${c.name}"`,
        href: `/relacionamento/campanhas/${c.id}`,
        severity: "info",
        dedupeKey: `campaign:${c.id}:${k}:${mid}`,
        email: true,
      });
    }
  }
  return NextResponse.json({ ok: true });
}

/** Ações: transição de etapa, teste, comentário, IA de copy, prévia, contagem. */
export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const c = await load(g.workspaceId, id);
  if (!c) return bad("Campanha não encontrada", 404);
  const actor = await flowActor(g.workspaceId);
  const action = str(body.action);

  if (action === "transition") {
    const r = await transitionCampaign(g.workspaceId, c.id, str(body.to) as CampaignAction, actor, {
      comment: str(body.comment) || undefined,
      scheduledAt: str(body.scheduledAt) || undefined,
      confirmCount: body.confirmCount != null ? Number(body.confirmCount) : undefined,
    });
    if (!r.ok) return bad(r.error);
    return NextResponse.json(r);
  }

  if (action === "comment") {
    const text = str(body.body).slice(0, 4000);
    if (!text) return bad("Comentário vazio");
    const row = await prisma.messageCampaignComment.create({
      data: { campaignId: c.id, memberId: actor.memberId, authorName: actor.name, kind: "COMENTARIO", body: text },
    });
    const others = [c.ownerMemberId, c.approverMemberId].filter((m): m is string => Boolean(m) && m !== actor.memberId);
    for (const mid of new Set(others)) {
      await notify({
        clienteId: g.workspaceId,
        memberId: mid,
        type: "campaign.comment",
        title: `${actor.name ?? "Alguém"} comentou em "${c.name}"`,
        body: text.slice(0, 300),
        href: `/relacionamento/campanhas/${c.id}`,
        severity: "info",
        dedupeKey: `campaign-comment:${row.id}:${mid}`,
        email: false,
      });
    }
    return NextResponse.json({ ok: true });
  }

  if (action === "test") {
    try {
      const out = await sendCampaignTest(g.workspaceId, c.id, {
        email: str(body.email) || actor.email,
        phone: str(body.phone) || null,
      });
      return NextResponse.json({ ok: true, result: out });
    } catch (err) {
      return bad(err instanceof Error ? err.message : "Falha no teste");
    }
  }

  if (action === "preview") {
    const content = parseContent(c.content);
    const raw = body.content ?? content.email ?? { subject: "", blocks: [] };
    const r = await previewEmail(g.workspaceId, raw, { couponCode: c.couponCode });
    return NextResponse.json({ html: r.html, bytes: r.bytes, clipped: r.clipped });
  }

  if (action === "count") {
    const audience = (body.audience ?? c.audience) as CampaignAudience;
    const channel = ["EMAIL", "WHATSAPP", "BOTH"].includes(str(body.channel)) ? str(body.channel) : c.channel;
    const [count, sample] = await Promise.all([
      audienceCount(g.workspaceId, audience, channel),
      audienceSample(g.workspaceId, audience, 10),
    ]);
    return NextResponse.json({ count, sample });
  }

  if (action === "ai_copy") {
    try {
      const { suggestCampaignCopy } = await import("@/lib/flows/ai-copy");
      const s = await suggestCampaignCopy(g.workspaceId, {
        name: c.name,
        briefing: c.briefing as CampaignBriefing,
        couponCode: c.couponCode,
      });
      return NextResponse.json({ ok: true, suggestion: s });
    } catch (err) {
      return bad(err instanceof Error ? err.message : "IA indisponível");
    }
  }

  if (action === "delete") {
    if (!["IDEIA", "PERDIDA", "BRIEFING"].includes(c.status)) return bad("Só campanhas em ideia, briefing ou perdidas podem ser excluídas");
    await prisma.messageCampaign.delete({ where: { id: c.id } });
    return NextResponse.json({ ok: true });
  }

  return bad("Ação inválida");
}
