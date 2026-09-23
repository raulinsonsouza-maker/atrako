/**
 * Mercado Pago — validação de webhook.
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 * Sempre validar assinatura antes de mutar pedido/booking/ledger.
 */

import { createHmac, timingSafeEqual } from "crypto";

async function resolveWebhookSecret(explicit?: string): Promise<string | undefined> {
  if (explicit?.trim()) return explicit.trim();
  try {
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const app = await resolvePlatformApp("MERCADO_PAGO");
    const fromApp = app?.credentials.webhookSecret?.trim();
    if (fromApp) return fromApp;
  } catch {
    // fall through
  }
  // Env is seed-only; production should use PlatformApp in /admin/apps.
  return process.env.MP_WEBHOOK_SECRET?.trim() || undefined;
}

/**
 * Valida x-signature do MP quando o secret (PlatformApp ou env) estiver configurado.
 * Em dev sem secret, retorna true (não bloquear smoke local).
 */
export async function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret?: string;
}): Promise<boolean> {
  const secret = await resolveWebhookSecret(opts.secret);
  if (!secret) return true;
  if (!opts.xSignature || !opts.xRequestId) return false;

  const parts = Object.fromEntries(
    opts.xSignature.split(",").map((p) => {
      const [k, v] = p.trim().split("=");
      return [k, v];
    }),
  );
  const ts = parts.ts;
  const v1 = parts.v1;
  if (!ts || !v1) return false;

  const manifest = `id:${opts.dataId};request-id:${opts.xRequestId};ts:${ts};`;
  const expected = createHmac("sha256", secret).update(manifest).digest("hex");
  try {
    return timingSafeEqual(Buffer.from(expected), Buffer.from(v1));
  } catch {
    return false;
  }
}
