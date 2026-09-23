import { createCipheriv, createDecipheriv, createHash, randomBytes } from "crypto";

function getKey() {
  const raw = process.env.MP_TOKEN_ENCRYPTION_KEY;
  if (!raw || raw.length < 32) {
    throw new Error("MP_TOKEN_ENCRYPTION_KEY must be set (64 hex chars recommended)");
  }
  return Buffer.from(raw.slice(0, 64), "hex");
}

export function encryptSecret(plain: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", getKey(), iv);
  const enc = Buffer.concat([cipher.update(plain, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

export function decryptSecret(payload: string) {
  const [ivHex, tagHex, dataHex] = payload.split(":");
  const decipher = createDecipheriv("aes-256-gcm", getKey(), Buffer.from(ivHex, "hex"));
  decipher.setAuthTag(Buffer.from(tagHex, "hex"));
  const dec = Buffer.concat([
    decipher.update(Buffer.from(dataHex, "hex")),
    decipher.final(),
  ]);
  return dec.toString("utf8");
}

export function sha256Hex(value: string) {
  return createHash("sha256").update(value.trim().toLowerCase()).digest("hex");
}

export function randomToken(bytes = 32) {
  return randomBytes(bytes).toString("hex");
}
