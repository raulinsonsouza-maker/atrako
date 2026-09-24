import { createHmac, timingSafeEqual } from "crypto";
import { resolvePlatformApp } from "@/lib/config/platformApps";

const ORDER_TOPICS = new Set([
  "orders/create",
  "orders/updated",
  "orders/paid",
  "ORDERS_CREATE",
  "ORDERS_UPDATED",
  "ORDERS_PAID",
]);

const CUSTOMER_TOPICS = new Set([
  "customers/create",
  "customers/update",
  "CUSTOMERS_CREATE",
  "CUSTOMERS_UPDATE",
]);

const PRODUCT_TOPICS = new Set([
  "products/create",
  "products/update",
  "PRODUCTS_CREATE",
  "PRODUCTS_UPDATE",
]);

export function isShopifyOrderTopic(topic: string): boolean {
  return ORDER_TOPICS.has(topic.trim());
}

export function isShopifyCustomerTopic(topic: string): boolean {
  return CUSTOMER_TOPICS.has(topic.trim());
}

export function isShopifyProductTopic(topic: string): boolean {
  return PRODUCT_TOPICS.has(topic.trim());
}

export async function getShopifyWebhookSecret(): Promise<string | null> {
  const app = await resolvePlatformApp("SHOPIFY");
  const secret =
    app?.credentials.clientSecret?.trim() ||
    app?.credentials.webhookSecret?.trim() ||
    process.env.SHOPIFY_API_SECRET?.trim() ||
    process.env.SHOPIFY_CLIENT_SECRET?.trim() ||
    null;
  return secret || null;
}

/** Verifica header X-Shopify-Hmac-Sha256 (base64). */
export function verifyShopifyWebhookHmac(
  rawBody: string,
  hmacHeader: string | null,
  secret: string,
): boolean {
  if (!hmacHeader || !secret) return false;
  const digest = createHmac("sha256", secret).update(rawBody, "utf8").digest("base64");
  try {
    const a = Buffer.from(digest);
    const b = Buffer.from(hmacHeader);
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}

export async function registerShopifyWebhooks(input: {
  shop: string;
  accessToken: string;
  apiVersion: string;
  callbackBaseUrl: string;
  workspaceId: string;
}): Promise<{ registered: string[]; errors: string[] }> {
  const { shopifyGraphql } = await import("./client");
  const callbackUrl = `${input.callbackBaseUrl.replace(/\/$/, "")}/api/webhooks/shopify/${input.workspaceId}`;
  const topics = [
    "ORDERS_CREATE",
    "ORDERS_UPDATED",
    "ORDERS_PAID",
    "CUSTOMERS_CREATE",
    "CUSTOMERS_UPDATE",
    "PRODUCTS_CREATE",
    "PRODUCTS_UPDATE",
  ] as const;

  const registered: string[] = [];
  const errors: string[] = [];

  for (const topic of topics) {
    try {
      const result = await shopifyGraphql<{
        webhookSubscriptionCreate?: {
          userErrors?: Array<{ message: string }>;
          webhookSubscription?: { id: string };
        };
      }>({
        shop: input.shop,
        accessToken: input.accessToken,
        apiVersion: input.apiVersion,
        query: `
          mutation webhookSubscriptionCreate($topic: WebhookSubscriptionTopic!, $callbackUrl: URL!) {
            webhookSubscriptionCreate(
              topic: $topic
              webhookSubscription: { callbackUrl: $callbackUrl, format: JSON }
            ) {
              userErrors { field message }
              webhookSubscription { id }
            }
          }
        `,
        variables: { topic, callbackUrl },
      });
      const errs = result.data?.webhookSubscriptionCreate?.userErrors ?? [];
      if (errs.length) {
        errors.push(`${topic}: ${errs.map((e) => e.message).join("; ")}`);
      } else if (result.errors?.length) {
        errors.push(`${topic}: ${result.errors.map((e) => e.message).join("; ")}`);
      } else {
        registered.push(topic);
      }
    } catch (err) {
      errors.push(`${topic}: ${err instanceof Error ? err.message : "failed"}`);
    }
  }

  return { registered, errors };
}
