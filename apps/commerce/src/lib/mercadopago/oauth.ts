/**
 * Mercado Pago OAuth for the commerce app.
 *
 * Platform app credentials (client id/secret/redirect) resolve via Atrako PlatformApp
 * (`/admin/apps` → MERCADO_PAGO), not a parallel commerce env silo.
 *
 * Dealers connecting a seller account should use the Atrako hub:
 *   `/config/conexoes` → Mercado Pago (WorkspaceConnection).
 *
 * Local DX: `MP_*` / `ATRAKO_PLATFORM_MP_*` remain valid fallbacks when the hub is unreachable.
 */
import { createHash, randomBytes } from "crypto";
import { resolveMercadoPagoPlatformCredentials } from "@/lib/atrako-platform";

export function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

export async function getAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
}) {
  const { clientId, redirectUri } = await resolveMercadoPagoPlatformCredentials();
  const url = new URL("https://auth.mercadopago.com/authorization");
  url.searchParams.set("client_id", clientId);
  url.searchParams.set("response_type", "code");
  url.searchParams.set("platform_id", "mp");
  url.searchParams.set("state", params.state);
  url.searchParams.set("redirect_uri", redirectUri);
  url.searchParams.set("code_challenge", params.codeChallenge);
  url.searchParams.set("code_challenge_method", "S256");
  return url.toString();
}

export async function exchangeAuthorizationCode(input: {
  code: string;
  codeVerifier: string;
  testToken?: boolean;
}) {
  const { clientId, clientSecret, redirectUri } =
    await resolveMercadoPagoPlatformCredentials();
  const body = {
    client_id: clientId,
    client_secret: clientSecret,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: redirectUri,
    code_verifier: input.codeVerifier,
    test_token: input.testToken ?? false,
  };
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth token exchange failed: ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    public_key: string;
    user_id: number;
    expires_in: number;
    live_mode: boolean;
  }>;
}

export async function refreshAccessToken(refreshToken: string) {
  const { clientId, clientSecret } = await resolveMercadoPagoPlatformCredentials();
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: clientId,
      client_secret: clientSecret,
      grant_type: "refresh_token",
      refresh_token: refreshToken,
    }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`OAuth refresh failed: ${text}`);
  }
  return res.json() as Promise<{
    access_token: string;
    refresh_token?: string;
    public_key: string;
    user_id: number;
    expires_in: number;
    live_mode: boolean;
  }>;
}
