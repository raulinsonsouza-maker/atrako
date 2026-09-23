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
};

export function buildPublicClienteDashboard(cliente: PublicClienteDashboardSource) {
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
  };
}