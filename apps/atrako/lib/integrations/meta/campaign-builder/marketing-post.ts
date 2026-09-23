/**
 * Helpers Graph POST form (Marketing API).
 */

import { metaGraphPostForm } from "@/lib/integrations/meta/graph";

function flattenForForm(body: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(body)) {
    if (v === undefined || v === null) continue;
    if (typeof v === "string" || typeof v === "number" || typeof v === "boolean") {
      out[k] = String(v);
    } else {
      out[k] = JSON.stringify(v);
    }
  }
  return out;
}

export async function metaMarketingPost(
  path: string,
  accessToken: string,
  body: Record<string, unknown>,
) {
  return metaGraphPostForm(path, accessToken, flattenForForm(body));
}
