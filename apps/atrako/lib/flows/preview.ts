/**
 * Prévia de e-mail sem criar MessageDelivery (editor, tema, aba Envios).
 * Usa produtos reais da loja quando existem — a prévia fica fiel ao envio.
 */

import { prisma } from "@/lib/db";
import { loadEmailTheme, sanitizeTheme } from "@/lib/flows/theme";
import { renderEmail, sanitizeEmailContent, GMAIL_CLIP_BYTES } from "@/lib/flows/render-email";
import { getRecommendations } from "@/lib/flows/recommendations";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import type { EmailContent, RenderItem } from "@/lib/flows/types";

async function sampleItems(workspaceId: string): Promise<RenderItem[]> {
  const rows = await prisma.marketplaceOrderItem.findMany({
    where: { order: { clienteId: workspaceId }, imageUrl: { not: null } },
    orderBy: { order: { createdAt: "desc" } },
    take: 2,
    select: { title: true, quantity: true, unitPriceCents: true, imageUrl: true, productUrl: true },
  });
  if (rows.length) return rows.map((r) => ({ ...r, quantity: r.quantity ?? 1 }));
  return [
    { title: "Produto exemplo", quantity: 1, unitPriceCents: 12990, imageUrl: null, productUrl: null },
    { title: "Outro produto", quantity: 2, unitPriceCents: 4990, imageUrl: null, productUrl: null },
  ];
}

export async function previewEmail(
  workspaceId: string,
  rawContent: unknown,
  opts?: { draftTheme?: boolean; themeOverride?: unknown; couponCode?: string | null; contactName?: string | null },
) {
  const content: EmailContent = sanitizeEmailContent(rawContent);
  const { theme: loaded, brand } = await loadEmailTheme(workspaceId, { draft: opts?.draftTheme ?? true });
  const theme = opts?.themeOverride ? sanitizeTheme(opts.themeOverride, loaded) : loaded;
  const items = await sampleItems(workspaceId);
  const needsRecs = content.blocks.some((b) => b.type === "recommendations");
  const recommendations = needsRecs
    ? await getRecommendations(workspaceId, { seedTitles: items.map((i) => i.title), limit: 4 }).catch(() => [])
    : [];
  const origin = getServerPublicOrigin();
  const storeUrl = brand.prefs.storeUrl || origin;
  const rendered = renderEmail({
    theme,
    content,
    ctx: {
      contactName: opts?.contactName ?? "Maria Silva",
      storeName: brand.storeName,
      couponCode: opts?.couponCode ?? "VOLTA10",
      couponExpires: null,
      items,
      totalCents: items.reduce((s, i) => s + (i.unitPriceCents ?? 0) * (i.quantity ?? 1), 0),
      currency: brand.currency,
      primaryUrl: storeUrl,
      recommendations,
      unsubscribeUrl: `${origin}/u/preview`,
      trackUrl: (url) => url || storeUrl,
    },
  });
  return { ...rendered, clipped: rendered.bytes > GMAIL_CLIP_BYTES };
}

/** Re-render de um envio a partir do contentSnapshot (aba Envios). */
export async function previewDelivery(workspaceId: string, deliveryId: string) {
  const d = await prisma.messageDelivery.findFirst({
    where: { id: deliveryId, clienteId: workspaceId },
    select: { channel: true, contentSnapshot: true, couponCode: true },
  });
  if (!d) return null;
  const snap = (d.contentSnapshot ?? {}) as {
    content?: unknown;
    preview?: string;
    ctx?: { contactName?: string | null };
  };
  if (d.channel === "WHATSAPP") return { channel: "WHATSAPP" as const, text: snap.preview ?? "" };
  if (!snap.content) return { channel: "EMAIL" as const, html: null };
  const r = await previewEmail(workspaceId, snap.content, {
    draftTheme: false,
    couponCode: d.couponCode,
    contactName: snap.ctx?.contactName ?? null,
  });
  return { channel: "EMAIL" as const, html: r.html };
}
