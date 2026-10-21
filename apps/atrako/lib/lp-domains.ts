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
};

const DOMAINS: Record<string, LpDomain> = {
  "lp.regicenter.com": {
    dir: "/lp/regicenter-franquia",
    name: "Regicenter",
    icon: "/lp/regicenter-franquia/assets/favicon.png",
    appleIcon: "/lp/regicenter-franquia/assets/apple-touch-icon.png",
    workspaceSlug: "regicenter",
    logoOnDark: "/lp/regicenter-franquia/assets/regicenter-logo-branco.png",
  },
};

export function lpDomainForWorkspace(slug: string | null | undefined): LpDomain | null {
  if (!slug) return null;
  return Object.values(DOMAINS).find((domain) => domain.workspaceSlug === slug) ?? null;
}

/** Host público (produção) do domínio do workspace, para links em e-mail. */
export function lpHostForWorkspace(slug: string | null | undefined): string | null {
  if (!slug) return null;
  return Object.entries(DOMAINS).find(([, domain]) => domain.workspaceSlug === slug)?.[0] ?? null;
}

/** Em dev, `lp.regicenter.localhost:5000` simula o domínio (o navegador resolve *.localhost para 127.0.0.1). */
export const LP_DOMAINS: Record<string, LpDomain> =
  process.env.NODE_ENV === "production"
    ? DOMAINS
    : {
        ...DOMAINS,
        ...Object.fromEntries(
          Object.entries(DOMAINS).map(([host, domain]) => [host.replace(/\.[a-z]+$/, ".localhost"), domain]),
        ),
      };

/** No domínio do cliente, `/crm/*` é reescrito para `app/atendimento/*`. */
export const LP_AREA_PATH = "/crm";
export const LP_AREA_TARGET = "/atendimento";

/** Prefixos do Atrako expostos no domínio do cliente; o resto volta para a LP. */
export const LP_DOMAIN_ALLOWED_PREFIXES = ["/api/", "/sign-in", "/change-password", "/pagar/"];
