import { SignJWT, jwtVerify } from "jose";

export const SYMBIUS_SESSION_COOKIE = "symbius_session";

export type SymbiusSession = {
  userId: string;
  organizationId: string;
  role: string;
  email: string;
  nome: string;
};

function getSecret(): Uint8Array {
  const secret =
    process.env.SYMBIUS_NEXTAUTH_SECRET ??
    process.env.NEXTAUTH_SECRET ??
    "symbius-dev-secret-change-in-production";
  return new TextEncoder().encode(secret);
}

export async function createSessionToken(
  payload: SymbiusSession,
): Promise<string> {
  return new SignJWT({ ...payload })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("30d")
    .sign(getSecret());
}

export async function verifySessionToken(
  token: string,
): Promise<SymbiusSession | null> {
  try {
    const { payload } = await jwtVerify(token, getSecret());
    if (
      typeof payload.userId !== "string" ||
      typeof payload.organizationId !== "string" ||
      typeof payload.role !== "string" ||
      typeof payload.email !== "string" ||
      typeof payload.nome !== "string"
    ) {
      return null;
    }
    return {
      userId: payload.userId,
      organizationId: payload.organizationId,
      role: payload.role,
      email: payload.email,
      nome: payload.nome,
    };
  } catch {
    return null;
  }
}
