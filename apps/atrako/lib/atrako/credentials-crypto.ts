import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

const ALGO = "aes-256-gcm";

function getKey(): Buffer {
  const raw =
    process.env.ATRAKO_CONNECTIONS_SECRET?.trim() ||
    process.env.AUTH_SECRET?.trim() ||
    process.env.NEXTAUTH_SECRET?.trim() ||
    "atrako-local-connections-secret-32b";
  return createHash("sha256").update(raw).digest();
}

/** Criptografa objeto de credenciais para gravar em WorkspaceConnection.credentialsEnc */
export function encryptCredentials(data: Record<string, unknown>): {
  v: 1;
  iv: string;
  tag: string;
  data: string;
} {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGO, getKey(), iv);
  const plaintext = Buffer.from(JSON.stringify(data), "utf8");
  const enc = Buffer.concat([cipher.update(plaintext), cipher.final()]);
  const tag = cipher.getAuthTag();
  return {
    v: 1,
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: enc.toString("base64"),
  };
}

export function decryptCredentials(blob: unknown): Record<string, unknown> {
  if (!blob || typeof blob !== "object") return {};
  const b = blob as { v?: number; iv?: string; tag?: string; data?: string };
  if (b.v !== 1 || !b.iv || !b.tag || !b.data) {
    // legado plaintext JSON
    return blob as Record<string, unknown>;
  }
  const decipher = createDecipheriv(ALGO, getKey(), Buffer.from(b.iv, "base64"));
  decipher.setAuthTag(Buffer.from(b.tag, "base64"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(b.data, "base64")),
    decipher.final(),
  ]);
  return JSON.parse(dec.toString("utf8")) as Record<string, unknown>;
}
