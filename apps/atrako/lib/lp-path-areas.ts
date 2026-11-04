/**
 * Áreas de atendimento sob path no host do Atrako (sem domínio próprio).
 * Ex.: atrako.com.br/vilaris/crm → mesmo shell que lp.regicenter.com/crm.
 */

export type LpPathArea = {
  /** Prefixo público da área (sem barra final). */
  prefix: string;
  workspaceSlug: string;
  name: string;
  logoOnDark: string | null;
  icon: string;
};

export const LP_PATH_AREAS: LpPathArea[] = [
  {
    prefix: "/vilaris/crm",
    workspaceSlug: "vilaris",
    name: "Vilaris",
    logoOnDark: "/lp/vilaris/assets/vilaris-logo.png",
    icon: "/lp/vilaris/assets/favicon.svg",
  },
];

export function matchLpPathArea(pathname: string | null | undefined): LpPathArea | null {
  if (!pathname) return null;
  for (const area of LP_PATH_AREAS) {
    if (pathname === area.prefix || pathname.startsWith(`${area.prefix}/`)) return area;
  }
  return null;
}

/** Resolve área a partir do `next` do sign-in (ex. `/vilaris/crm/leads`). */
export function matchLpPathAreaFromNext(next: string | null | undefined): LpPathArea | null {
  if (!next || !next.startsWith("/") || next.startsWith("//")) return null;
  const path = next.split("?")[0] ?? next;
  return matchLpPathArea(path);
}
