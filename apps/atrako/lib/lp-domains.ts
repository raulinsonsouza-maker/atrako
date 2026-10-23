/**
 * Domínios de clientes que servem uma LP estática de `public/` na raiz e a área de atendimento em `/crm`.
 * Cada host também precisa de um router no Traefik (deploy/stack.yml) e do registro DNS apontando para a VPS.
 */
export type LpDomain = {
  dir: string;
  name: string;
  icon: string;
  appleIcon: string;
  /** Slug do workspace dono do domínio. */
  workspaceSlug: string;
  /** Logo claro para o menu escuro da área (o `Cliente.logoUrl` vai em e-mails e fundos claros). */
  logoOnDark?: string;
  /** Guia público para IAs/buscadores (GeoSite). Ausente = domínio sem guia. */
  geoBasePath?: string;
  /** Host de produção (igual à chave em produção; em dev aponta do `.localhost` para o real). */
  canonicalHost: string;
};

const DOMAINS: Record<string, Omit<LpDomain, "canonicalHost">> = {
  "lp.regicenter.com": {
    dir: "/lp/regicenter-franquia",
    name: "Regicenter",
    icon: "/lp/regicenter-franquia/assets/favicon.png",
    appleIcon: "/lp/regicenter-franquia/assets/apple-touch-icon.png",
    workspaceSlug: "regicenter",
    logoOnDark: "/lp/regicenter-franquia/assets/regicenter-logo-branco.png",
    geoBasePath: "/guia",
  },
};

const PROD_DOMAINS: Record<string, LpDomain> = Object.fromEntries(
  Object.entries(DOMAINS).map(([host, domain]) => [host, { ...domain, canonicalHost: host }]),
);

export function lpDomainForWorkspace(slug: string | null | undefined): LpDomain | null {
  if (!slug) return null;
  return Object.values(PROD_DOMAINS).find((domain) => domain.workspaceSlug === slug) ?? null;
}

/** Host público (produção) do domínio do workspace, para links em e-mail. */
export function lpHostForWorkspace(slug: string | null | undefined): string | null {
  return lpDomainForWorkspace(slug)?.canonicalHost ?? null;
}

/** Em dev, `lp.regicenter.localhost:5000` simula o domínio (o navegador resolve *.localhost para 127.0.0.1). */
export const LP_DOMAINS: Record<string, LpDomain> =
  process.env.NODE_ENV === "production"
    ? PROD_DOMAINS
    : {
        ...PROD_DOMAINS,
        ...Object.fromEntries(
          Object.entries(PROD_DOMAINS).map(([host, domain]) => [host.replace(/\.[a-z]+$/, ".localhost"), domain]),
        ),
      };

/** No domínio do cliente, `/crm/*` é reescrito para `app/atendimento/*`. */
export const LP_AREA_PATH = "/crm";
export const LP_AREA_TARGET = "/atendimento";

/** Rota interna das páginas públicas do guia (`/site/{host}/…`). */
export const GEO_INTERNAL_PREFIX = "/site";

/** OAuth iniciado na área do cliente volta para fechar o popup no mesmo domínio (sessão e postMessage). */
export function lpOAuthReturnTo(origin: string): string | null {
  try {
    const host = new URL(origin).hostname.toLowerCase();
    return LP_DOMAINS[host] ? `${origin}${LP_AREA_PATH}/oauth-complete` : null;
  } catch {
    return null;
  }
}

/** Prefixos do Atrako expostos no domínio do cliente. */
export const LP_DOMAIN_ALLOWED_PREFIXES = ["/api/", "/sign-in", "/change-password", "/pagar/"];

/** Caminhos do domínio do cliente que não devem ser indexados. */
export const LP_DOMAIN_NOINDEX_PREFIXES = ["/api/", "/sign-in", "/change-password", "/pagar/", LP_AREA_PATH];

/** Páginas públicas do domínio do cliente servidas pela rota do guia (fora do basePath). */
export const LP_DOMAIN_SITE_PAGES = ["/privacidade"];
