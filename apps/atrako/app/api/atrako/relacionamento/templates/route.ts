import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import {
  WA_TEMPLATE_LIBRARY,
  PARAM_EXAMPLES,
  createCustomTemplate,
  createTemplateVersion,
  ensureDefaultWaTemplates,
  lintTemplate,
  renderTemplatePreview,
} from "@/lib/flows/wa-templates";
import { syncAndPromote, checkWebhookSubscriptions } from "@/lib/flows/wa-sync";
import { getWhatsAppMetadata } from "@/lib/flows/wa-limits";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";

export const maxDuration = 60;

const PURPOSE_LABELS: Record<string, string> = {
  cart_1: "Carrinho — 1º lembrete",
  cart_coupon: "Carrinho — cupom",
  cart_lto: "Carrinho — oferta com prazo",
  order_unpaid: "Pedido não pago",
  second_purchase: "Segunda compra",
  repurchase: "Recompra",
  winback: "Reativação",
  lost_nurture: "Nutrição de perdidos",
  welcome: "Boas-vindas",
  birthday: "Aniversário",
};

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const [wa, refs, events, account, usage] = await Promise.all([
    resolveWhatsApp(ws),
    prisma.waTemplateRef.findMany({
      where: { clienteId: ws, status: { notIn: ["DELETED"] } },
      orderBy: [{ purpose: "asc" }, { version: "desc" }],
    }),
    prisma.waTemplateEvent.findMany({
      where: { clienteId: ws },
      orderBy: { createdAt: "desc" },
      take: 300,
      select: { id: true, templateRefId: true, field: true, event: true, detail: true, createdAt: true },
    }),
    getWhatsAppMetadata(ws).catch(() => ({})),
    prisma.messageDelivery.groupBy({
      by: ["templateName"],
      where: { clienteId: ws, channel: "WHATSAPP", isTest: false, createdAt: { gte: new Date(Date.now() - 30 * 86_400_000) } },
      _count: { _all: true, deliveredAt: true, openedAt: true, clickedAt: true, failedAt: true },
      _sum: { costMicros: true },
    }),
  ]);
  const subscriptions = request.nextUrl.searchParams.get("subscriptions") === "1" ? await checkWebhookSubscriptions() : null;
  const usageBy = new Map(usage.map((u) => [u.templateName, u]));
  return NextResponse.json({
    connected: Boolean(wa),
    account,
    subscriptions,
    library: WA_TEMPLATE_LIBRARY.map((d) => ({
      purpose: d.purpose,
      label: PURPOSE_LABELS[d.purpose] ?? d.purpose,
      category: d.category,
      body: d.body,
    })),
    templates: refs.map((r) => {
      const u = usageBy.get(r.name);
      return {
        id: r.id,
        name: r.name,
        status: r.status,
        category: r.category,
        requestedCategory: r.requestedCategory,
        qualityScore: r.qualityScore,
        rejectedReason: r.rejectedReason,
        purpose: r.purpose,
        purposeLabel: r.purpose ? PURPOSE_LABELS[r.purpose] ?? r.purpose : "Sem finalidade",
        version: r.version,
        replacedById: r.replacedById,
        pauseCount: r.pauseCount,
        pausedUntil: r.pausedUntil?.toISOString() ?? null,
        lastUsedAt: r.lastUsedAt?.toISOString() ?? null,
        updatedAt: r.updatedAt.toISOString(),
        components: r.components,
        preview: renderTemplatePreview(r.components, PARAM_EXAMPLES),
        events: events.filter((e) => e.templateRefId === r.id).slice(0, 20),
        usage: u
          ? {
              sent: u._count._all,
              delivered: u._count.deliveredAt,
              read: u._count.openedAt,
              clicked: u._count.clickedAt,
              failed: u._count.failedAt,
              costMicros: u._sum.costMicros ?? 0,
            }
          : null,
      };
    }),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const action = str(body.action);
  const g = await gate(request, action === "lint" ? "operate" : "manage", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;

  try {
    switch (action) {
      case "sync":
        return NextResponse.json({ ok: true, ...(await syncAndPromote(ws)) });
      case "ensure_defaults":
        return NextResponse.json({ ok: true, ...(await ensureDefaultWaTemplates(ws)) });
      case "lint": {
        const buttons = Array.isArray(body.buttons) ? (body.buttons as Array<{ type: string; text?: string }>) : [];
        return NextResponse.json(
          lintTemplate({
            category: str(body.category) || "MARKETING",
            body: str(body.body),
            buttons,
            footer: str(body.footer) || undefined,
          }),
        );
      }
      case "new_version": {
        const category = str(body.category);
        const ref = await createTemplateVersion(ws, str(body.refId), {
          body: str(body.body) || undefined,
          category: category === "UTILITY" || category === "MARKETING" ? category : undefined,
        });
        return NextResponse.json({ ok: true, id: ref.id, status: ref.status });
      }
      case "create_custom": {
        const category = str(body.category) === "UTILITY" ? "UTILITY" : "MARKETING";
        const campaignId = str(body.campaignId);
        if (campaignId) {
          const c = await prisma.messageCampaign.findFirst({ where: { id: campaignId, clienteId: ws }, select: { id: true } });
          if (!c) return bad("Campanha não encontrada");
        }
        const ref = await createCustomTemplate(ws, {
          purpose: campaignId ? `campanha_${campaignId.slice(-8)}` : str(body.purpose) || "personalizado",
          category,
          body: str(body.body),
          buttonText: str(body.buttonText) || null,
          imageHeader: body.imageHeader === true,
          copyCode: body.copyCode === true,
        });
        if (campaignId) {
          await prisma.messageCampaign.update({ where: { id: campaignId }, data: { waTemplateRefId: ref.id } });
        }
        return NextResponse.json({ ok: true, id: ref.id, status: ref.status });
      }
    }
  } catch (err) {
    return bad(err instanceof Error ? err.message : "Falha");
  }
  return bad("Ação inválida");
}
