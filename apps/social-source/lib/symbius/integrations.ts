import crypto from "crypto";
import { prisma } from "@/lib/db";

export async function getOrCreateOrgSettings(organizationId: string) {
  return prisma.igOrgSettings.upsert({
    where: { organizationId },
    create: { organizationId },
    update: {},
  });
}

export async function ensureApiKey(organizationId: string): Promise<string> {
  const settings = await getOrCreateOrgSettings(organizationId);
  if (settings.apiKey) return settings.apiKey;
  const apiKey = `sym_${crypto.randomBytes(24).toString("hex")}`;
  await prisma.igOrgSettings.update({
    where: { organizationId },
    data: { apiKey },
  });
  return apiKey;
}

export async function fireOutboundWebhook(
  organizationId: string,
  event: string,
  payload: Record<string, unknown>,
): Promise<void> {
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId },
  });
  if (!settings?.webhookUrl) return;
  const events = settings.webhookEvents ?? [];
  if (events.length > 0 && !events.includes(event) && !events.includes("*")) {
    return;
  }

  try {
    await fetch(settings.webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        event,
        organizationId,
        timestamp: new Date().toISOString(),
        data: payload,
      }),
    });
  } catch (e) {
    console.warn("[symbius/webhook]", e);
  }
}

export async function appendGoogleSheetRow(
  organizationId: string,
  row: Record<string, string>,
): Promise<void> {
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId },
  });
  if (!settings?.googleSheetId) return;

  const webhookUrl = process.env.SYMBIUS_GOOGLE_SHEETS_WEBHOOK_URL;
  if (!webhookUrl) return;

  try {
    const res = await fetch(webhookUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        sheetId: settings.googleSheetId,
        tab: settings.googleSheetTab ?? "Leads",
        row,
      }),
    });
    if (!res.ok) {
      console.warn("[symbius/sheets] HTTP", res.status, await res.text());
    }
  } catch (e) {
    console.warn("[symbius/sheets]", e);
  }
}

export async function syncLeadToCentralCrm(params: {
  organizationId: string;
  email?: string;
  phone?: string;
  username?: string;
  nome?: string;
  tags?: string[];
  stId?: string;
  valor?: number;
  transactionId?: string;
  dadosMarketing?: Record<string, unknown>;
}): Promise<void> {
  const org = await prisma.organization.findUnique({
    where: { id: params.organizationId },
    select: { centralClienteId: true },
  });
  if (!org?.centralClienteId) return;

  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId: params.organizationId },
  });
  if (settings && !settings.syncCentralCrm) return;

  const base =
    process.env.NEXTAUTH_URL ??
    process.env.SYMBIUS_APP_URL ??
    "http://localhost:3000";

  try {
    const res = await fetch(`${base}/api/clientes/${org.centralClienteId}/crm/leads`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(process.env.SYMBIUS_INTERNAL_API_KEY
          ? { "x-internal-key": process.env.SYMBIUS_INTERNAL_API_KEY }
          : {}),
      },
      body: JSON.stringify({
        source: "symbius_flow",
        email: params.email,
        phone: params.phone,
        name: params.nome ?? params.username,
        tags: params.tags,
        stId: params.stId,
        valor: params.valor,
        transactionId: params.transactionId,
        dadosMarketing: params.dadosMarketing,
      }),
    });
    if (!res.ok) {
      console.warn(
        "[symbius/central-crm] HTTP",
        res.status,
        await res.text().catch(() => ""),
      );
    }
  } catch (e) {
    console.warn("[symbius/central-crm]", e);
  }
}

export async function verifyPublicApiKey(
  organizationId: string,
  apiKey: string | null,
): Promise<boolean> {
  if (!apiKey) return false;
  const settings = await prisma.igOrgSettings.findUnique({
    where: { organizationId },
  });
  return Boolean(settings?.apiKey && settings.apiKey === apiKey);
}
