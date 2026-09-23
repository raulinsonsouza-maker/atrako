import "server-only";

import { prisma } from "@/lib/db";
import { buildLoginThrottleIdentifiers, nextThrottleBucketState } from "@/lib/authSecurity";
import { getTrustedClientIp } from "@/lib/requestSecurity";

const WINDOW_MS = 15 * 60 * 1000;
const IP_LIMIT = 30;
const IP_USERNAME_LIMIT = 8;

export class LoginThrottleConfigurationError extends Error {}

function throttleSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV !== "production") return "local-development-login-throttle-secret";
  throw new LoginThrottleConfigurationError("SESSION_SECRET não configurado");
}

export function throttleIdentifiers(input: { ip: string | null; username: unknown }, secret: string) {
  return buildLoginThrottleIdentifiers(input.ip, input.username, secret);
}

export async function consumeLoginThrottle(input: {
  request: Request;
  username: unknown;
  now?: Date;
}): Promise<{ allowed: boolean; retryAfterSeconds: number }> {
  const now = input.now ?? new Date();
  const identifiers = throttleIdentifiers(
    { ip: getTrustedClientIp(input.request), username: input.username },
    throttleSecret(),
  );
  return prisma.$transaction(async (tx) => {
    // Keep the table bounded without retaining historical identifiers.
    await tx.loginThrottle.deleteMany({
      where: { windowStartedAt: { lt: new Date(now.getTime() - WINDOW_MS) } },
    });
    const keys = [
      ...(identifiers.hasTrustedIp && identifiers.ipHash
        ? [{ key: identifiers.ipHash, limit: IP_LIMIT }]
        : []),
      { key: identifiers.ipUsernameHash, limit: IP_USERNAME_LIMIT },
    ];
    let retryAfterSeconds = 1;
    for (const bucket of keys) {
      // Serialize updates for each digest without exposing it outside the DB.
      await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtextextended(${`login-throttle:${bucket.key}`}, 0))`;
      const current = await tx.loginThrottle.findUnique({ where: { bucketKeyHash: bucket.key } });
      const next = nextThrottleBucketState(
        current ? { windowStartedAt: current.windowStartedAt, attemptCount: current.attemptCount } : null,
        now,
        bucket.limit,
        WINDOW_MS,
      );
      retryAfterSeconds = Math.max(retryAfterSeconds, next.retryAfterSeconds);
      if (current) {
        await tx.loginThrottle.update({
          where: { id: current.id },
          data: { windowStartedAt: next.state.windowStartedAt, attemptCount: next.state.attemptCount },
        });
      } else {
        await tx.loginThrottle.create({
          data: {
            bucketKeyHash: bucket.key,
            windowStartedAt: next.state.windowStartedAt,
            attemptCount: next.state.attemptCount,
          },
        });
      }
      if (!next.allowed) return { allowed: false, retryAfterSeconds };
    }
    return { allowed: true, retryAfterSeconds };
  }, { isolationLevel: "Serializable" });
}