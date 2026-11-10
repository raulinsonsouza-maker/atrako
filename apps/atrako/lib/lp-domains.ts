/**
 * Domínios de clientes: LP na raiz (HTML em `public/` ou rota App) e área de atendimento em `/crm`.
 * Cada host também precisa de um router no Traefik (deploy/stack.yml) e do registro DNS apontando para a VPS.
 */
export type LpDomain = {
  /** Pasta em `public/` com `index.html` (LP estática). Ausente quando a home é rota App. */
  dir?: string;
  /** Rota App servida na raiz do domínio (ex. `/vilaris`). */
  appHome?: string;
  name: string;
  icon: string;
  appleIcon: string;
  /** Slug do workspace dono do domínio. */
  workspaceSlug: string;
  /** Logo claro para o menu escuro da área (o `Cliente.logoUrl` vai em e-mails e fundos claros). */
  logoOnDark?: string;
  /** Guia público para IAs/buscadores (GeoSite). Ausente = domínio sem guia. */
  geoBasePath?: string;
  /** Host de produção (apex quando há www). */
  canonicalHost: string;
};

type DomainSeed = Omit<LpDomain, "canonicalHost"> & { canonicalHost?: string };

const VILARIS_DOMAIN: DomainSeed = {
  appHome: "/vilaris",
  name: "Vilaris",
  icon: "/lp/vilaris/assets/favicon.svg",
  appleIcon: "/lp/vilaris/assets/favicon.svg",
  workspaceSlug: "vilaris",
  logoOnDark: "/lp/vilaris/assets/vilaris-logo-branco.png",
  canonicalHost: "vilarisgestao.com.br",
};

const DOMAINS: Record<string, DomainSeed> = {
  "lp.regicenter.com": {
    dir: "/lp/regicenter-franquia",
    name: "Regicenter",
    icon: "/lp/regicenter-franquia/assets/favicon.png",
    appleIcon: "/lp/regicenter-franquia/assets/apple-touch-icon.png",
    workspaceSlug: "regicenter",
    logoOnDark: "/lp/regicenter-franquia/assets/regicenter-logo-branco.png",
    geoBasePath: "/guia",
  },
  "vilarisgestao.com.br": VILARIS_DOMAIN,
  "www.vilarisgestao.com.br": VILARIS_DOMAIN,
};

const PROD_DOMAINS: Record<string, LpDomain> = Object.fromEntries(
  Object.entries(DOMAINS).map(([host, domain]) => [
    host,
    { ...domain, canonicalHost: domain.canonicalHost ?? host },
  ]),
);

export function lpDomainForWorkspace(slug: string | null | undefined): LpDomain | null {
  if (!slug) return null;
  const apex = Object.entries(PROD_DOMAINS).find(
    ([host, domain]) => domain.workspaceSlug === slug && host === domain.canonicalHost,
  );
  if (apex) return apex[1];
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

/** Formulário passo a passo da Regicenter, servido no domínio da LP. */
export const REGICENTER_QUALIFY_FORM_PATH = "/f/franquia-regicenter-qualify";

/** Prefixos do Atrako expostos no domínio do cliente. */
export const LP_DOMAIN_ALLOWED_PREFIXES = ["/api/", "/sign-in", "/change-password", "/pagar/", "/social", "/config/conexoes"];

/** URL pública do formulário no domínio da LP, quando o workspace tem um. */
export function workspaceFormUrl(workspaceSlug: string, formSlug: string): string | null {
  const host = lpHostForWorkspace(workspaceSlug);
  if (!host) return null;
  return `https://${host}/f/${formSlug}`;
}

/** Caminhos do domínio do cliente que não devem ser indexados. */
export const LP_DOMAIN_NOINDEX_PREFIXES = ["/api/", "/sign-in", "/change-password", "/pagar/", LP_AREA_PATH];

/** Páginas públicas do domínio do cliente servidas pela rota do guia (fora do basePath). */
export const LP_DOMAIN_SITE_PAGES = ["/privacidade", "/cof"];
