import "server-only";

import { prisma } from "@/lib/db";
import {
  createOAuthStateToken,
  digestOAuthState,
  OAUTH_STATE_TTL_MS,
} from "@/lib/oauthStateSecurity";

export { digestOAuthState, isOAuthStateUsable, OAUTH_STATE_TTL_MS } from "@/lib/oauthStateSecurity";

export async function issueOAuthState(input: {
  provider: string;
  clienteId: string;
  initiatedByInternalUserId: string;
  now?: Date;
}): Promise<string> {
  const now = input.now ?? new Date();
  // Expired rows are no longer useful and can otherwise accumulate forever.
  await prisma.oAuthState.deleteMany({ where: { expiresAt: { lt: now } } });

  const token = createOAuthStateToken();
  await prisma.oAuthState.create({
    data: {
      stateDigest: digestOAuthState(token),
      expiresAt: new Date(now.getTime() + OAUTH_STATE_TTL_MS),
      provider: input.provider,
      clienteId: input.clienteId,
      initiatedByInternalUserId: input.initiatedByInternalUserId,
    },
  });
  return token;
}

/**
 * The conditional update is the single-use gate. Concurrent callbacks race
 * on consumedAt and exactly one can transition the row from unconsumed.
 */
export async function consumeOAuthState(
  token: string,
  provider: string,
  now = new Date(),
) {
  const stateDigest = digestOAuthState(token);
  const consumedAt = now;
  const updated = await prisma.oAuthState.updateMany({
    where: {
      stateDigest,
      provider,
      consumedAt: null,
      expiresAt: { gt: now },
    },
    data: { consumedAt },
  });
  if (updated.count !== 1) return null;
  return prisma.oAuthState.findUnique({ where: { stateDigest } });
}