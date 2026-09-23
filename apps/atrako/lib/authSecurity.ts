import { createHash, createHmac, randomBytes, scrypt as nodeScrypt, timingSafeEqual } from "node:crypto";
function deriveKey(password: string, salt: Buffer): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    nodeScrypt(password, salt, SCRYPT_KEY_BYTES, {
      N: SCRYPT_N,
      r: SCRYPT_R,
      p: SCRYPT_P,
      maxmem: SCRYPT_MAXMEM,
    }, (error, derived) => {
      if (error) reject(error);
      else resolve(derived);
    });
  });
}

// N=32768, r=8 uses roughly 32 MiB per operation. Keep maxmem bounded so a
// login burst cannot make an autoscaled instance swap or exhaust its memory.
const SCRYPT_N = 32_768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 32;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;
const PASSWORD_HASH_VERSION = "scrypt-v1";

// A valid, fixed-cost hash used for unknown usernames. It prevents username
// enumeration through the much faster "user not found" branch.
const DUMMY_PASSWORD_HASH =
  "scrypt-v1$32768,8,1$YXV0aC1kdW1teS1zYWx0IQ$mAFWYAwCxStOcpr27jls_O8gBBgGJu7jzpKIAUANuSU";

export const USERNAME_PATTERN = /^[a-z0-9._-]{3,40}$/;
export const MIN_PASSWORD_LENGTH = 8;

/** Normalize and validate the canonical username stored in the database. */
export function normalizeUsername(value: unknown): string | null {
  if (typeof value !== "string") return null;
  const normalized = value.trim().toLowerCase();
  if (normalized.length < 3 || normalized.length > 40 || !USERNAME_PATTERN.test(normalized)) {
    return null;
  }
  return normalized;
}

export function isInternalBootstrapEligible(input: {
  flag: unknown;
  configuredUsername: unknown;
  attemptedUsername: unknown;
  configuredPassword: unknown;
  attemptedPassword: unknown;
}): boolean {
  const configuredUsername = normalizeUsername(input.configuredUsername);
  const attemptedUsername = normalizeUsername(input.attemptedUsername);
  return input.flag === "true"
    && configuredUsername !== null
    && attemptedUsername === configuredUsername
    && typeof input.configuredPassword === "string"
    && input.configuredPassword === input.attemptedPassword;
}

export function isLegacyBootstrapCandidate(input: {
  active: boolean;
  role: string;
  username: string | null;
  passwordHash: string | null;
}): boolean {
  return input.active
    && input.role === "ADMIN"
    && input.username === null
    && input.passwordHash === null;
}

export function isPendingBootstrapRecoveryCandidate(input: {
  active: boolean;
  role: string;
  username: string | null;
  passwordHash: string | null;
  failedLoginCount: number;
  mustChangePassword: boolean;
  passwordChangedAt: Date | null;
}, configuredUsername: string): boolean {
  return input.active
    && input.role === "ADMIN"
    && input.username === configuredUsername
    && input.passwordHash !== null
    && input.failedLoginCount >= 5;
}

/** Require a bounded password with an uppercase letter and a special character. */
export function validatePassword(value: unknown, _username?: string | null): string | null {
  if (typeof value !== "string" || value.length < MIN_PASSWORD_LENGTH || value.length > 256) {
    return "A senha deve ter entre 8 e 256 caracteres.";
  }
  if (!/\p{Lu}/u.test(value)) return "A senha deve conter pelo menos uma letra maiúscula.";
  if (!/[^\p{L}\p{N}\s]/u.test(value)) return "A senha deve conter pelo menos um caractere especial.";
  return null;
}

function encodePart(value: Buffer): string {
  return value.toString("base64url");
}

function decodePart(value: string): Buffer {
  return Buffer.from(value, "base64url");
}

export async function hashPassword(password: string): Promise<string> {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await deriveKey(password, salt);
  return `${PASSWORD_HASH_VERSION}$${SCRYPT_N},${SCRYPT_R},${SCRYPT_P}$${encodePart(salt)}$${encodePart(derived)}`;
}

function parseHash(encoded: string): { salt: Buffer; digest: Buffer } | null {
  const parts = encoded.split("$");
  if (parts.length !== 4 || parts[0] !== PASSWORD_HASH_VERSION || parts[1] !== "32768,8,1") {
    return null;
  }
  try {
    const salt = decodePart(parts[2]);
    const digest = decodePart(parts[3]);
    if (salt.length !== SCRYPT_SALT_BYTES || digest.length !== SCRYPT_KEY_BYTES) return null;
    return { salt, digest };
  } catch {
    return null;
  }
}

/**
 * Verify a password using a constant-time digest comparison. A missing or
 * malformed stored hash still performs a dummy verification.
 */
export async function verifyPassword(password: string, encodedHash: string | null | undefined): Promise<boolean> {
  const parsed = encodedHash ? parseHash(encodedHash) : null;
  const target = parsed ?? parseHash(DUMMY_PASSWORD_HASH)!;
  const derived = await deriveKey(password, target.salt);
  const matches = timingSafeEqual(derived, target.digest);
  return parsed !== null && matches;
}

/** Bind a successful verification to the exact password version reloaded in a transaction. */
export function isPasswordHashCurrent(verifiedHash: string | null, currentHash: string | null): boolean {
  return verifiedHash !== null && verifiedHash === currentHash;
}

export function createSessionToken(): string {
  return randomBytes(32).toString("base64url");
}

/** Store only this digest; never persist or log the opaque cookie value. */
export function hashSessionToken(token: string): string {
  return createHash("sha256").update(token, "utf8").digest("hex");
}

export function isSessionExpired(
  session: { revokedAt: Date | null; idleExpiresAt: Date; absoluteExpiresAt: Date },
  now = new Date(),
): boolean {
  return session.revokedAt !== null
    || session.idleExpiresAt.getTime() <= now.getTime()
    || session.absoluteExpiresAt.getTime() <= now.getTime();
}

export interface ThrottleBucketState {
  windowStartedAt: Date;
  attemptCount: number;
}

export function nextThrottleBucketState(
  state: ThrottleBucketState | null,
  now = new Date(),
  limit = 30,
  windowMs = 15 * 60 * 1000,
): { allowed: boolean; state: ThrottleBucketState; retryAfterSeconds: number } {
  const active = state !== null && now.getTime() - state.windowStartedAt.getTime() < windowMs;
  const next = active
    ? { windowStartedAt: state.windowStartedAt, attemptCount: state.attemptCount + 1 }
    : { windowStartedAt: now, attemptCount: 1 };
  const retryAfterSeconds = Math.max(
    1,
    Math.ceil(((next.windowStartedAt.getTime() + windowMs) - now.getTime()) / 1000),
  );
  return {
    allowed: next.attemptCount <= limit,
    state: next,
    retryAfterSeconds,
  };
}

/** Hash a scoped identifier with the deployment secret; the input is never persisted. */
export function hashLoginBucketKey(
  scope: "ip" | "ip-username" | "username-fallback",
  identifier: string,
  secret: string,
): string {
  return createHmac("sha256", secret).update(`${scope}\0${identifier}`, "utf8").digest("hex");
}

export function buildLoginThrottleIdentifiers(
  ip: string | null,
  username: unknown,
  secret: string,
): { ipHash: string | null; ipUsernameHash: string; hasTrustedIp: boolean } {
  const normalizedUsername = normalizeUsername(username) ?? "unknown";
  if (!ip) {
    return {
      ipHash: null,
      ipUsernameHash: hashLoginBucketKey("username-fallback", normalizedUsername, secret),
      hasTrustedIp: false,
    };
  }
  return {
    ipHash: hashLoginBucketKey("ip", ip, secret),
    ipUsernameHash: hashLoginBucketKey("ip-username", `${ip}\0${normalizedUsername}`, secret),
    hasTrustedIp: true,
  };
}

export interface LoginLockState {
  failedLoginCount: number;
  failureWindowStartedAt: Date | null;
  lockedUntil: Date | null;
}

export function isLoginLocked(state: Pick<LoginLockState, "lockedUntil">, now = new Date()): boolean {
  return state.lockedUntil !== null && state.lockedUntil.getTime() > now.getTime();
}

/**
 * Calculate the next failed-login state. The caller must apply this result in
 * a conditional/transactional database update to make the decision atomic.
 */
export function nextFailedLoginState(
  state: LoginLockState,
  now = new Date(),
): LoginLockState {
  const windowMs = 15 * 60 * 1000;
  const lockMs = 15 * 60 * 1000;
  const inWindow =
    state.failureWindowStartedAt !== null &&
    now.getTime() - state.failureWindowStartedAt.getTime() < windowMs;
  const failureWindowStartedAt = inWindow ? state.failureWindowStartedAt : now;
  const failedLoginCount = inWindow ? state.failedLoginCount + 1 : 1;
  return {
    failedLoginCount,
    failureWindowStartedAt,
    lockedUntil: failedLoginCount >= 5 ? new Date(now.getTime() + lockMs) : state.lockedUntil,
  };
}

export function clearLoginFailures(): Pick<LoginLockState, "failedLoginCount" | "failureWindowStartedAt" | "lockedUntil"> {
  return { failedLoginCount: 0, failureWindowStartedAt: null, lockedUntil: null };
}

export const AUTH_COOKIE_NAME = "inout_session";
export const AUTH_COOKIE_NAME_PRODUCTION = "__Host-inout_session";
export const AUTH_IDLE_TIMEOUT_MS = 8 * 60 * 60 * 1000;
export const AUTH_ABSOLUTE_TIMEOUT_MS = 7 * 24 * 60 * 60 * 1000;