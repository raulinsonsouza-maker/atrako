/**
 * Instagram Graph — messaging / perfil.
 * Tokens: WorkspaceConnection provider=INSTAGRAM (via Config).
 * Doc: https://developers.facebook.com/docs/instagram-api
 */

import { metaGraphGet, META_GRAPH_VERSION } from "@/lib/integrations/meta/graph";
import { resolveInstagram } from "@/lib/config/resolveConnection";

export { META_GRAPH_VERSION };

export async function fetchIgProfile(workspaceId: string) {
  const creds = await resolveInstagram(workspaceId);
  if (!creds) return null;
  return metaGraphGet("/me", creds.accessToken, {
    fields: "id,username,name",
  });
}
