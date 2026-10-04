/**
 * Fecha o ciclo com mídia:
 * - venda recuperada por fluxo → evento CAPI `RecoveredPurchase` (não duplica o Purchase do pixel da loja);
 * - públicos (Perdidos, carrinhos, inativos, clientes para exclusão) exportáveis para Meta/Google.
 */

import { createHash } from "crypto";
import { prisma } from "@/lib/db";
import { getWorkspaceConfig, resolveTracking } from "@/lib/config/getWorkspaceConfig";

const sha256 = (v: string) => createHash("sha256").update(v.trim().toLowerCase()).digest("hex");
const DAY = 86_400_000;

type RecoveredInput = {
  workspaceId: string;
  contactId: string;
  orderRef: string;
  totalCents: number;
  paidAt: Date;
  deliveryId: string;
};
type SinkResult = { sent: boolean; reason?: string };

export async function sendRecoveredConversion(input: RecoveredInput): Promise<{ capi: SinkResult; ga4: SinkResult }> {
  const config = await getWorkspaceConfig(input.workspaceId);
  if (!config) return { capi: { sent: false, reason: "no_config" }, ga4: { sent: false, reason: "no_config" } };
  const tracking = resolveTracking(config);
  const delivery = await prisma.messageDelivery.findUnique({
    where: { id: input.deliveryId },
    select: { channel: true, flowId: true, campaignId: true },
  });
  const [capi, ga4] = await Promise.all([
    sendCapi(input, config.settings.currency ?? "BRL", tracking, delivery),
    sendGa4(input, config.settings.currency ?? "BRL", tracking, delivery),
  ]);
  return { capi, ga4 };
}

type Tracking = ReturnType<typeof resolveTracking>;
type DeliveryRef = { channel: string; flowId: string | null; campaignId: string | null } | null;
/** GA4 Measurement Protocol: client_id estável por contato (sem cookie do navegador). */
async function sendGa4(input: RecoveredInput, currency: string, tracking: Tracking, delivery: DeliveryRef): Promise<SinkResult> {
  if (!tracking.ga4MeasurementId || !tracking.ga4ApiSecret) return { sent: false, reason: "no_ga4" };
  const clientId = `${parseInt(sha256(input.contactId).slice(0, 8), 16)}.${Math.floor(input.paidAt.getTime() / 1000)}`;
  const url = `https://www.google-analytics.com/mp/collect?measurement_id=${encodeURIComponent(tracking.ga4MeasurementId)}&api_secret=${encodeURIComponent(tracking.ga4ApiSecret)}`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      user_id: input.contactId,
      timestamp_micros: input.paidAt.getTime() * 1000,
      events: [
        {
          name: "recovered_purchase",
          params: {
            transaction_id: input.orderRef,
            value: input.totalCents / 100,
            currency,
            channel: delivery?.channel?.toLowerCase(),
            source: delivery?.campaignId ? "campaign" : "flow",
          },
        },
      ],
    }),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { sent: false, reason: `ga4_${res.status}` };
  return { sent: true };
}

async function sendCapi(input: RecoveredInput, currency: string, tracking: Tracking, delivery: DeliveryRef): Promise<SinkResult> {
  const { pixelId, capiToken } = tracking;
  if (!pixelId || !capiToken) return { sent: false, reason: "no_capi" };
  const contact = await prisma.nativeContact.findUnique({
    where: { id: input.contactId },
    select: { email: true, phone: true, phoneE164: true },
  });
  const userData: Record<string, string[]> = {};
  if (contact?.email) userData.em = [sha256(contact.email)];
  const phone = (contact?.phoneE164 || contact?.phone || "").replace(/\D/g, "");
  if (phone) userData.ph = [sha256(phone)];
  if (!Object.keys(userData).length) return { sent: false, reason: "no_identity" };

  const body = {
    data: [
      {
        event_name: "RecoveredPurchase",
        event_time: Math.floor(input.paidAt.getTime() / 1000),
        event_id: `rec-${input.orderRef}`.slice(0, 100),
        action_source: "other",
        user_data: userData,
        custom_data: {
          value: input.totalCents / 100,
          currency,
          order_id: input.orderRef,
          channel: delivery?.channel?.toLowerCase(),
          source: delivery?.campaignId ? "campaign" : "flow",
        },
      },
    ],
  };
  const res = await fetch(`https://graph.facebook.com/v21.0/${encodeURIComponent(pixelId)}/events`, {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${capiToken}` },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) return { sent: false, reason: `capi_${res.status}` };
  return { sent: true };
}

export const AD_AUDIENCES = [
  { key: "lost", label: "Perdidos", description: "Leads perdidos sem compra — remarketing" },
  { key: "carts", label: "Carrinhos abertos", description: "Abandonaram carrinho nos últimos 30 dias" },
  { key: "inactive", label: "Inativos", description: "Clientes em risco ou inativos — reativação" },
  { key: "customers", label: "Clientes (excluir)", description: "Compraram — use como exclusão em aquisição" },
  { key: "vip", label: "VIP", description: "Melhores clientes — base para lookalike" },
] as const;
export type AdAudienceKey = (typeof AD_AUDIENCES)[number]["key"];

/** Contatos do público (sem opt-out de marketing por e-mail quando houver só e-mail). */
export async function audienceContacts(workspaceId: string, key: AdAudienceKey, limit = 50_000) {
  const base = { clienteId: workspaceId };
  let contactIds: string[] = [];
  if (key === "lost") {
    const leads = await prisma.nativeLead.findMany({
      where: { ...base, status: "LOST", contactId: { not: null } },
      select: { contactId: true },
      take: limit,
    });
    const buyers = new Set(
      (await prisma.customerProfile.findMany({ where: { ...base, ordersCount: { gt: 0 } }, select: { contactId: true } })).map(
        (p) => p.contactId,
      ),
    );
    contactIds = leads.map((l) => l.contactId!).filter((id) => !buyers.has(id));
  } else if (key === "carts") {
    const carts = await prisma.abandonedCart.findMany({
      where: { ...base, status: "OPEN", contactId: { not: null }, abandonedAt: { gte: new Date(Date.now() - 30 * DAY) } },
      select: { contactId: true },
      take: limit,
    });
    contactIds = carts.map((c) => c.contactId!);
  } else {
    const where =
      key === "inactive"
        ? { lifecycle: { in: ["EM_RISCO", "INATIVO"] } }
        : key === "vip"
          ? { lifecycle: "VIP" }
          : { ordersCount: { gt: 0 } };
    const rows = await prisma.customerProfile.findMany({ where: { ...base, ...where }, select: { contactId: true }, take: limit });
    contactIds = rows.map((r) => r.contactId);
  }
  const unique = Array.from(new Set(contactIds));
  if (!unique.length) return [];
  const out: Array<{ email: string | null; phone: string | null; name: string }> = [];
  for (let i = 0; i < unique.length; i += 5000) {
    const chunk = await prisma.nativeContact.findMany({
      where: { id: { in: unique.slice(i, i + 5000) } },
      select: { email: true, phone: true, phoneE164: true, name: true },
    });
    for (const c of chunk) {
      const phone = (c.phoneE164 || c.phone || "").replace(/\D/g, "") || null;
      if (!c.email && !phone) continue;
      out.push({ email: c.email?.toLowerCase() ?? null, phone, name: c.name });
    }
  }
  return out;
}

/** CSV no formato aceito por Meta (Custom Audience) e Google (Customer Match), já com hash SHA-256. */
export function audienceCsv(rows: Array<{ email: string | null; phone: string | null; name: string }>, hashed = true) {
  const lines = ["email,phone,fn"];
  for (const r of rows) {
    const fn = (r.name ?? "").trim().split(/\s+/)[0]?.toLowerCase() ?? "";
    const phone = r.phone ? (r.phone.startsWith("55") ? r.phone : `55${r.phone}`) : "";
    const cols = hashed
      ? [r.email ? sha256(r.email) : "", phone ? sha256(phone) : "", fn ? sha256(fn) : ""]
      : [r.email ?? "", phone, fn];
    lines.push(cols.join(","));
  }
  return lines.join("\n");
}
