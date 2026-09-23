/**
 * Mercado Pago — validação de webhook.
 * Doc: https://www.mercadopago.com.br/developers/pt/docs/your-integrations/notifications/webhooks
 * Sempre validar assinatura antes de mutar pedido/booking/ledger.
 */

import { createHmac, timingSafeEqual } from "crypto";

/**
 * Valida x-signature do MP quando MP_WEBHOOK_SECRET estiver configurado.
 * Em dev sem secret, retorna true (não bloquear smoke local).
 */
export function verifyMpWebhookSignature(opts: {
  xSignature: string | null;
  xRequestId: string | null;
  dataId: string;
  secret?: string;
}): boolean {
  const secret = opts.secret ?? process.env.MP_WEBHOOK_SECRET?.trim();
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
