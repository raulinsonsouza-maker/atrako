/**
 * Shopify Admin GraphQL client.
 * https://shopify.dev/docs/api/admin-graphql/latest
 */

import { getWorkspaceConnection } from "@/lib/atrako/workspace-connections";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import {
  DEFAULT_SHOPIFY_API_VERSION,
  normalizeShopifyShop,
} from "./oauth";

export type ShopifyGraphqlResult<T> = {
  data?: T;
  errors?: Array<{ message: string }>;
  extensions?: unknown;
};

export async function resolveShopifyConnection(workspaceId: string): Promise<{
  shop: string;
  accessToken: string;
  apiVersion: string;
} | null> {
  const wc = await getWorkspaceConnection(workspaceId, "SHOPIFY");
  if (!wc || wc.status !== "ACTIVE") return null;
  const shopRaw =
    typeof wc.credentials.shop === "string"
      ? wc.credentials.shop
      : typeof wc.metadata === "object" &&
          wc.metadata &&
          !Array.isArray(wc.metadata) &&
          typeof (wc.metadata as Record<string, unknown>).shop === "string"
        ? String((wc.metadata as Record<string, unknown>).shop)
        : "";
  const shop = normalizeShopifyShop(shopRaw);
  const accessToken =
    typeof wc.credentials.accessToken === "string"
      ? wc.credentials.accessToken.trim()
      : "";
  if (!shop || !accessToken) return null;

  const app = await resolvePlatformApp("SHOPIFY");
  const apiVersion =
    (typeof app?.credentials.apiVersion === "string" &&
      app.credentials.apiVersion.trim()) ||
    DEFAULT_SHOPIFY_API_VERSION;

  return { shop, accessToken, apiVersion };
}

export async function shopifyGraphql<T = unknown>(input: {
  shop: string;
  accessToken: string;
  apiVersion?: string;
  query: string;
  variables?: Record<string, unknown>;
}): Promise<ShopifyGraphqlResult<T>> {
  const version = input.apiVersion || DEFAULT_SHOPIFY_API_VERSION;
  const res = await fetch(
    `https://${input.shop}/admin/api/${version}/graphql.json`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        "X-Shopify-Access-Token": input.accessToken,
      },
      body: JSON.stringify({
        query: input.query,
        variables: input.variables ?? {},
      }),
    },
  );
  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`shopify_graphql_http:${res.status}:${text.slice(0, 200)}`);
  }
  return (await res.json()) as ShopifyGraphqlResult<T>;
}

export async function shopifyGraphqlForWorkspace<T = unknown>(
  workspaceId: string,
  query: string,
  variables?: Record<string, unknown>,
): Promise<ShopifyGraphqlResult<T>> {
  const conn = await resolveShopifyConnection(workspaceId);
  if (!conn) throw new Error("Shopify não conectado");
  return shopifyGraphql<T>({
    shop: conn.shop,
    accessToken: conn.accessToken,
    apiVersion: conn.apiVersion,
    query,
    variables,
  });
}
