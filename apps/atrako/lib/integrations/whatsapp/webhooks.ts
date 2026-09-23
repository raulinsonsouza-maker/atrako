/**
 * Webhooks WhatsApp Cloud API — verify + assinatura.
 * Doc: https://developers.facebook.com/documentation/business-messaging/whatsapp/webhooks/overview
 */

import { createHmac, timingSafeEqual } from "crypto";
import { prisma } from "@/lib/db";
import { decryptCredentials } from "@/lib/atrako/credentials-crypto";

async function metaAppSecret(): Promise<string> {
  try {
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const app = await resolvePlatformApp("META");
    const fromApp =
      app?.credentials.webhookSecret?.trim() ||
      app?.credentials.clientSecret?.trim() ||
      "";
    if (fromApp) return fromApp;
  } catch {
    // fall through
  }
  return (
    process.env.META_APP_SECRET?.trim() ||
    process.env.SYMBIUS_IG_APP_SECRET?.trim() ||
    process.env.FACEBOOK_APP_SECRET?.trim() ||
    ""
  );
}

export async function verifyWaWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
): Promise<boolean> {
  const appSecret = await metaAppSecret();
  if (!appSecret) {
    return process.env.NODE_ENV !== "production";
  }
  if (!signatureHeader?.startsWith("sha256=")) return false;
  const expected = createHmac("sha256", appSecret).update(rawBody, "utf8").digest("hex");
  const received = signatureHeader.slice("sha256=".length);
  try {
    const a = Buffer.from(expected, "hex");
    const b = Buffer.from(received, "hex");
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

/** Resolve workspace pelo phone_number_id gravado em metadata/credentials da conexão WHATSAPP. */
export async function findWorkspaceByPhoneNumberId(phoneNumberId: string) {
  if (!phoneNumberId) return null;
  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "WHATSAPP", status: "ACTIVE" },
  });
  for (const row of rows) {
    const meta = (row.metadata ?? {}) as Record<string, unknown>;
    if (meta.phoneNumberId === phoneNumberId) {
      return { workspaceId: row.clienteId, connectionId: row.id };
    }
    const creds = decryptCredentials(row.credentialsEnc);
    if (creds.phoneNumberId === phoneNumberId) {
      return { workspaceId: row.clienteId, connectionId: row.id };
    }
  }
  return null;
}

/** GET hub.verify_token — PlatformApp META, env seed, ou token de workspace WHATSAPP ativo. */
export async function matchWebhookVerifyToken(token: string): Promise<boolean> {
  try {
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const app = await resolvePlatformApp("META");
    const fromApp = app?.credentials.webhookVerifyToken?.trim() || "";
    if (fromApp && token === fromApp) return true;
  } catch {
    // fall through to env / workspace
  }

  const platform =
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN?.trim() ||
    process.env.META_WEBHOOK_VERIFY_TOKEN?.trim() ||
    "";
  if (platform && token === platform) return true;

  const rows = await prisma.workspaceConnection.findMany({
    where: { provider: "WHATSAPP", status: "ACTIVE" },
  });
  for (const row of rows) {
    const creds = decryptCredentials(row.credentialsEnc);
    if (typeof creds.webhookVerifyToken === "string" && creds.webhookVerifyToken === token) {
      return true;
    }
  }
  return false;
}
