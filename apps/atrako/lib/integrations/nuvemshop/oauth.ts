/**
 * OAuth Nuvemshop / Tiendanube.
 * https://dev.nuvemshop.com.br/docs/erp-guide/authentication
 */

export const DEFAULT_NUVEMSHOP_SCOPES =
  "read_orders,read_products,read_customers";
export const NUVEMSHOP_AUTHORIZE_BASE =
  "https://www.nuvemshop.com.br/apps";
export const NUVEMSHOP_TOKEN_URL =
  "https://www.nuvemshop.com/apps/authorize/token";
export const NUVEMSHOP_API_BASE = "https://api.nuvemshop.com.br/v1";

export function buildNuvemshopAuthorizeUrl(input: {
  clientId: string;
  state: string;
}): string {
  const url = new URL(
    `${NUVEMSHOP_AUTHORIZE_BASE}/${encodeURIComponent(input.clientId)}/authorize`,
  );
  url.searchParams.set("state", input.state);
  return url.toString();
}

export type NuvemshopTokenResponse = {
  access_token: string;
  token_type?: string;
  scope?: string;
  user_id?: string | number;
  error?: string;
  message?: string;
};

export async function exchangeNuvemshopCode(input: {
  clientId: string;
  clientSecret: string;
  code: string;
}): Promise<NuvemshopTokenResponse> {
  const res = await fetch(NUVEMSHOP_TOKEN_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({
      client_id: input.clientId,
      client_secret: input.clientSecret,
      grant_type: "authorization_code",
      code: input.code,
    }),
  });
  const text = await res.text().catch(() => "");
  let json: NuvemshopTokenResponse;
  try {
    json = JSON.parse(text) as NuvemshopTokenResponse;
  } catch {
    throw new Error(`nuvemshop_token_failed:${res.status}:${text.slice(0, 200)}`);
  }
  if (!res.ok || !json.access_token) {
    throw new Error(
      `nuvemshop_token_failed:${res.status}:${json.error || json.message || text.slice(0, 200)}`,
    );
  }
  return json;
}
