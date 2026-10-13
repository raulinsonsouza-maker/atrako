export type PublicClienteDashboardSource = {
  id: string;
  nome: string;
  slug: string;
  logoUrl: string | null;
  ativo: boolean;
  segmento: string | null;
  objetivoMidia: string | null;
  socialMediaAtivo: boolean;
  perfilPanel: string | null;
  contas?: Array<{ plataforma?: string | null; accountIdPlataforma?: string | null }>;
};

export function buildPublicClienteDashboard(cliente: PublicClienteDashboardSource) {
  const linkedPlatforms = [
    ...new Set(
      (cliente.contas ?? [])
        .filter((conta) => conta.plataforma && conta.accountIdPlataforma)
        .map((conta) => String(conta.plataforma).toUpperCase()),
    ),
  ];
  return {
    id: cliente.id,
    nome: cliente.nome,
    slug: cliente.slug,
    logoUrl: cliente.logoUrl,
    ativo: cliente.ativo,
    segmento: cliente.segmento,
    objetivoMidia: cliente.objetivoMidia,
    socialMediaAtivo: cliente.socialMediaAtivo,
    perfilPanel: cliente.perfilPanel === "social-media" ? "social-media" : null,
    linkedPlatforms,
  };
}