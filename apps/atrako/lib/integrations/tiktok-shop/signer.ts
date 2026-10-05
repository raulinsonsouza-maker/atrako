/**
 * Assinatura HMAC-SHA256 TikTok Shop Open API (versões 202309+).
 * https://partner.tiktokshop.com/docv2/page/sign-your-api-request
 */

import { createHmac, timingSafeEqual } from "crypto";

export function hmacSha256Hex(secret: string, baseString: string): string {
  return createHmac("sha256", secret).update(baseString).digest("hex");
}

/**
 * secret + path + (query ordenada sem sign/access_token, como `k` + `v`) + body + secret.
 * Body só entra quando não é multipart.
 */
export function signTiktokShopRequest(input: {
  appSecret: string;
  path: string;
  query: Record<string, string>;
  body?: string | null;
}): string {
  const params = Object.keys(input.query)
    .filter((k) => k !== "sign" && k !== "access_token")
    .sort()
    .map((k) => `${k}${input.query[k]}`)
    .join("");
  const base = `${input.appSecret}${input.path}${params}${input.body ?? ""}${input.appSecret}`;
  return hmacSha256Hex(input.appSecret, base);
}

/** Webhook: header `Authorization` = HMAC-SHA256(app_secret, app_key + raw body). */
export function verifyTiktokShopSignature(input: {
  appKey: string;
  appSecret: string;
  rawBody: string;
  signature: string | null | undefined;
}): boolean {
  if (!input.signature) return false;
  const expected = hmacSha256Hex(input.appSecret, `${input.appKey}${input.rawBody}`);
  const a = Buffer.from(expected, "utf8");
  const b = Buffer.from(input.signature.trim().toLowerCase(), "utf8");
  return a.length === b.length && timingSafeEqual(a, b);
}
