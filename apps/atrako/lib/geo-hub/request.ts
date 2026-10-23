import "server-only";
import { cache } from "react";
import { headers } from "next/headers";
import { getWorkspaceConfig, resolveBrand, resolveTracking } from "@/lib/config/getWorkspaceConfig";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { geoLinker, loadGeoSite, loadSitePages } from "./site";

/** Host do request (sem porta). */
export async function requestHost() {
  return ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
}

/** Site + páginas + marca do request atual (memoizado por render). */
export const loadGeoContext = cache(async (rawHost: string) => {
  const host = decodeURIComponent(rawHost).toLowerCase();
  const site = await loadGeoSite(host);
  if (!site) return null;
  const linker = geoLinker(site, await requestHost());
  const [pages, config] = await Promise.all([
    loadSitePages(site.id, { preview: linker.preview }),
    getWorkspaceConfig(site.clienteId),
  ]);
  const brand = config ? resolveBrand(config) : null;
  const tracking = config ? resolveTracking(config) : null;
  return { site, pages, linker, brand, tracking, facts: site.factsParsed };
});

export type GeoContext = NonNullable<Awaited<ReturnType<typeof loadGeoContext>>>;

/** Para robots/sitemap/llms: domínio do cliente do request e o GeoSite dele (se houver). */
export async function publicSiteForRequest() {
  const host = await requestHost();
  const lp = LP_DOMAINS[host] ?? null;
  if (!lp) return { host, lp: null, site: null };
  const site = lp.geoBasePath ? await loadGeoSite(lp.canonicalHost) : null;
  return { host, lp, site };
}
