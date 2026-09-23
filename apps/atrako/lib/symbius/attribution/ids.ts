import { randomBytes } from "crypto";

function ulidish(prefix: string): string {
  const ts = Date.now().toString(36).toUpperCase();
  const rand = randomBytes(8).toString("hex").toUpperCase();
  return `${prefix}_${ts}${rand}`;
}

export function newStId(): string {
  return ulidish("st");
}

export function newVisitorId(): string {
  return ulidish("vis");
}

export function newSessionId(): string {
  return ulidish("sess");
}

export function newEventId(): string {
  return ulidish("evt");
}

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function normalizePhone(phone: string): string {
  return phone.replace(/\D/g, "");
}
