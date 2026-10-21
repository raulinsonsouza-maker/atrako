/**
 * Domínios de clientes que servem uma LP estática de `public/` na raiz e a área de atendimento em `/crm`.
 * Cada host também precisa de um router no Traefik (deploy/stack.yml) e do registro DNS apontando para a VPS.
 */
export type LpDomain = { dir: string; name: string };

const DOMAINS: Record<string, LpDomain> = {
  "lp.regicenter.com": { dir: "/lp/regicenter-franquia", name: "Regicenter" },
};

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
export const LP_DOMAIN_ALLOWED_PREFIXES = ["/api/", "/sign-in", "/change-password"];
