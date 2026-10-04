/**
 * Webhooks WooCommerce (HMAC SHA256).
 * Doc: https://woocommerce.github.io/woocommerce-rest-api-docs/#webhooks
 */

import { createHmac, randomUUID, timingSafeEqual } from "crypto";
import {
  decryptCredentials,
  encryptCredentials,
} from "@/lib/atrako/credentials-crypto";
import { prisma } from "@/lib/db";
import { resolveWooCredentials, wcFetch } from "./client";
import type { WooOrder } from "./orders";

export function verifyWooWebhookSignature(
  rawBody: string,
  signatureHeader: string | null,
  secret: string,
): boolean {
  if (!signatureHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(signatureHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export function isWooOrderTopic(topic: string | null): boolean {
  if (!topic) return true;
  const t = topic.toLowerCase();
  return (
    t === "order.created" ||
    t === "order.updated" ||
    t.includes("order.created") ||
    t.includes("order.updated")
  );
}

export async function getWooWebhookSecret(workspaceId: string): Promise<string | null> {
  const row = await prisma.workspaceConnection.findUnique({
    where: {
      clienteId_provider: { clienteId: workspaceId, provider: "WOOCOMMERCE" },
    },
  });
  if (!row || row.status !== "ACTIVE") return null;
  const creds = decryptCredentials(row.credentialsEnc);
  const secret =
    typeof creds.webhookSecret === "string" ? creds.webhookSecret.trim() : "";
  return secret || null;
}

export async function registerWooCommerceWebhooks(
  workspaceId: string,
  callbackUrl: string,
) {
  const resolved = await resolveWooCredentials(workspaceId);
  if (!resolved) throw new Error("WooCommerce não conectado");

  let secret = resolved.credentials.webhookSecret?.trim() || "";
  if (!secret) {
    secret = randomUUID();
    await prisma.workspaceConnection.update({
      where: { id: resolved.connectionId },
      data: {
        credentialsEnc: encryptCredentials({ ...resolved.credentials, webhookSecret: secret }),
      },
    });
  }

  const existing = await wcFetch<Array<{ id?: number; topic?: string; delivery_url?: string }>>(
    workspaceId,
    "/webhooks?per_page=100&status=active",
  );
  const topics = ["order.created", "order.updated"] as const;
  for (const topic of topics) {
    const current = existing.find(
      (hook) => hook.topic === topic && hook.delivery_url === callbackUrl,
    );
    if (current?.id != null) {
      await wcFetch(workspaceId, `/webhooks/${current.id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ secret, status: "active" }),
      });
      continue;
    }
    await wcFetch(workspaceId, "/webhooks", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        name: `Atrako ${topic}`,
        topic,
        delivery_url: callbackUrl,
        secret,
        status: "active",
      }),
    });
  }

  return { callbackUrl, topics: [...topics] };
}

export function parseWooOrderPayload(payload: unknown): WooOrder | null {
  if (!payload || typeof payload !== "object" || Array.isArray(payload)) {
    return null;
  }
  const o = payload as Record<string, unknown>;
  if (typeof o.id !== "number" && typeof o.id !== "string") return null;
  return {
    ...(o as unknown as WooOrder),
    id: Number(o.id),
  };
}
