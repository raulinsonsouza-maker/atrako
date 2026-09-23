import crypto from "crypto";

type StatePayload = {
  userId: string;
  tenantId: string;
  returnTo?: string;
};

const secret = process.env.BETTER_AUTH_SECRET || "dev-secret-change-in-production";

export function signOAuthState(payload: StatePayload) {
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  return `${data}.${sig}`;
}

export function verifyOAuthState(state: string): StatePayload {
  const [data, sig] = state.split(".");
  if (!data || !sig) throw new Error("Estado inválido");
  const expected = crypto.createHmac("sha256", secret).update(data).digest("base64url");
  if (!crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(expected))) throw new Error("Estado inválido");
  return JSON.parse(Buffer.from(data, "base64url").toString("utf-8")) as StatePayload;
}

export function sanitizeReturnTo(value?: string | null) {
  if (!value || typeof value !== "string") return "/dashboard/configuracoes";
  if (value.startsWith("/")) return value;
  return "/dashboard/configuracoes";
}
