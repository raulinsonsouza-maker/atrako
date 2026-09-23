import { NextResponse } from "next/server";
import { findClienteById, findClienteBySlug } from "@/lib/repositories/clientesRepository";
import { requireClienteAccess } from "@/lib/portalSession";
import { hasEffectiveInPilotAccessFor } from "@/lib/inpilotRolloutServer";
import { buildPublicClienteDashboard } from "@/lib/publicClienteDashboard";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const access = await requireClienteAccess(_request, id, "public-read");
  if (access.response) return access.response;
  const cliente = (await findClienteById(id)) ?? (await findClienteBySlug(id));
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  if (!access.internalUser && !access.portal) {
    return NextResponse.json(buildPublicClienteDashboard(cliente));
  }
  if (access.portal) {
    return NextResponse.json({
      id: cliente.id,
      nome: cliente.nome,
      slug: cliente.slug,
      logoUrl: cliente.logoUrl,
      ativo: cliente.ativo,
      segmento: cliente.segmento,
      gestor: cliente.gestor,
      objetivoMidia: cliente.objetivoMidia,
    });
  }
  // Never expose credentials, portal tokens, the per-client switch, or other
  // rollout internals to the dashboard. Account identifiers are retained only
  // because the dashboard uses them to decide which read-only panels apply.
  const {
    id: clienteId,
    nome,
    slug,
    logoUrl,
    ativo,
    segmento,
    gestor,
    squad,
    leadScoringEnabled,
    socialMediaAtivo,
    objetivoMidia,
    produtoServico,
    modeloNegocio,
    publicoAlvo,
    objetivoProjeto,
    diferenciais,
    observacoesAnaliticas,
    perfilPanel,
    ultimoSyncAt,
    orcamentoMidiaGoogleMensal,
    orcamentoMidiaMetaMensal,
    contas,
  } = cliente;
  const dashboardCliente = {
    id: clienteId,
    nome,
    slug,
    logoUrl,
    ativo,
    segmento,
    gestor,
    squad,
    leadScoringEnabled,
    socialMediaAtivo,
    objetivoMidia,
    produtoServico,
    modeloNegocio,
    publicoAlvo,
    objetivoProjeto,
    diferenciais,
    observacoesAnaliticas,
    perfilPanel,
    ultimoSyncAt,
    orcamentoMidiaGoogleMensal,
    orcamentoMidiaMetaMensal,
    contas: contas.map(({ plataforma, accountIdPlataforma }) => ({
      plataforma,
      accountIdPlataforma,
    })),
  };
  const inPilotAvailable = access.internalUser
    ? await hasEffectiveInPilotAccessFor(access.internalUser, cliente)
    : false;
  const response = NextResponse.json({ ...dashboardCliente, inPilotAvailable });
  response.headers.set("Cache-Control", "no-store, max-age=0");
  return response;
}
