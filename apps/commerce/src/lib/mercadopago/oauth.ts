import { createHash, randomBytes } from "crypto";

export function createPkce() {
  const codeVerifier = randomBytes(32).toString("base64url");
  const codeChallenge = createHash("sha256").update(codeVerifier).digest("base64url");
  const state = randomBytes(16).toString("hex");
  return { codeVerifier, codeChallenge, state };
}

export function getAuthorizationUrl(params: {
  state: string;
  codeChallenge: string;
}) {
  const clientId = process.env.MP_CLIENT_ID;
  const redirectUri = process.env.MP_REDIRECT_URI;
  if (!clientId || !redirectUri) {
    throw new Error("MP_CLIENT_ID and MP_REDIRECT_URI are required");
  }
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
  const body = {
    client_id: process.env.MP_CLIENT_ID,
    client_secret: process.env.MP_CLIENT_SECRET,
    grant_type: "authorization_code",
    code: input.code,
    redirect_uri: process.env.MP_REDIRECT_URI,
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
  const res = await fetch("https://api.mercadopago.com/oauth/token", {
    method: "POST",
    headers: { "Content-Type": "application/json", Accept: "application/json" },
    body: JSON.stringify({
      client_id: process.env.MP_CLIENT_ID,
      client_secret: process.env.MP_CLIENT_SECRET,
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
