import { cookies } from "next/headers";

export const SYMBIUS_ACTIVE_IG_COOKIE = "symbius_active_ig";

export async function getActiveIgAccountId(
  organizationId: string,
): Promise<string | null> {
  const jar = await cookies();
  const raw = jar.get(SYMBIUS_ACTIVE_IG_COOKIE)?.value;
  if (!raw) return null;
  const [orgId, accountId] = raw.split(":");
  if (orgId !== organizationId || !accountId) return null;
  return accountId;
}

export async function setActiveIgAccountCookie(
  organizationId: string,
  igAccountId: string | null,
): Promise<void> {
  const jar = await cookies();
  if (!igAccountId) {
    jar.delete(SYMBIUS_ACTIVE_IG_COOKIE);
    return;
  }
  jar.set(SYMBIUS_ACTIVE_IG_COOKIE, `${organizationId}:${igAccountId}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
}

export function igAccountFilter(
  organizationId: string,
  activeIgAccountId: string | null,
): { igAccountId?: string } {
  if (!activeIgAccountId) return {};
  return { igAccountId: activeIgAccountId };
}
