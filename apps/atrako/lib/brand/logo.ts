import { lpDomainForWorkspace } from "@/lib/lp-domains";

/** Logo para fundo escuro/de cor: o enviado em Config → Empresa; sem ele, o do domínio próprio do cliente. */
export function resolveLogoOnDark(stored: string | null | undefined, workspaceSlug: string | null | undefined) {
  return stored?.trim() || lpDomainForWorkspace(workspaceSlug)?.logoOnDark || null;
}

/** URL de logo vinda do PATCH: `null`/"" remove; aceita http(s):// ou caminho do próprio app. */
export function parseLogoUrlPatch(raw: unknown): { ok: true; value: string | null | undefined } | { ok: false } {
  if (raw === undefined) return { ok: true, value: undefined };
  if (raw === null) return { ok: true, value: null };
  if (typeof raw !== "string") return { ok: false };
  const url = raw.trim();
  if (!url) return { ok: true, value: null };
  if (url.length > 1024 || !/^(https?:\/\/|\/(?!\/))\S+$/.test(url)) return { ok: false };
  return { ok: true, value: url };
}
