import { createHash, randomBytes } from "node:crypto";

export const OAUTH_STATE_TTL_MS = 15 * 60 * 1000;

export type OAuthStateCheck = {
  provider: string;
  expiresAt: Date;
  consumedAt: Date | null;
};

export function createOAuthStateToken(): string {
  return randomBytes(32).toString("base64url");
}

export function digestOAuthState(state: string): string {
  return createHash("sha256").update(state, "utf8").digest("hex");
}

export function isOAuthStateUsable(
  state: OAuthStateCheck,
  provider: string,
  now = new Date(),
): boolean {
  return state.provider === provider
    && state.consumedAt === null
    && state.expiresAt.getTime() > now.getTime();
}