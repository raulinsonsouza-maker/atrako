import { prisma } from "@/lib/db";
import { randomUUID } from "crypto";

export async function findAllClientes(ativoOnly = true) {
  return prisma.cliente.findMany({
    where: ativoOnly ? { ativo: true } : undefined,
    orderBy: { nome: "asc" },
    include: {
      contas: true,
    },
  });
}

export async function findClienteById(id: string) {
  return prisma.cliente.findUnique({
    where: { id },
    include: { contas: true },
  });
}

export async function findClienteBySlug(slug: string) {
  return prisma.cliente.findUnique({
    where: { slug },
    include: { contas: true },
  });
}

export async function createCliente(data: {
  nome: string;
  slug: string;
  logoUrl?: string | null;
  segmento?: string | null;
  ativo?: boolean;
  orcamentoMidiaGoogleMensal?: number | null;
  orcamentoMidiaMetaMensal?: number | null;
  leadScoringEnabled?: boolean;
  socialMediaAtivo?: boolean;
  telegramAtivo?: boolean;
  inPilotEnabled?: boolean;
  objetivoMidia?: string;
  produtoServico?: string | null;
  modeloNegocio?: string | null;
  publicoAlvo?: string | null;
  objetivoProjeto?: string | null;
  diferenciais?: string | null;
  observacoesAnaliticas?: string | null;
  perfilPanel?: string | null;
  squad?: number | null;
}) {
  return prisma.cliente.create({
    data: {
      nome: data.nome,
      slug: data.slug,
      logoUrl: data.logoUrl ?? null,
      segmento: data.segmento ?? null,
      ativo: data.ativo ?? true,
      orcamentoMidiaGoogleMensal: data.orcamentoMidiaGoogleMensal ?? null,
      orcamentoMidiaMetaMensal: data.orcamentoMidiaMetaMensal ?? null,
      leadScoringEnabled: data.leadScoringEnabled ?? false,
      socialMediaAtivo: data.socialMediaAtivo ?? false,
      telegramAtivo: data.telegramAtivo ?? false,
      inPilotEnabled: data.inPilotEnabled ?? true,
      objetivoMidia: data.objetivoMidia ?? "leads",
      produtoServico: data.produtoServico ?? null,
      modeloNegocio: data.modeloNegocio ?? null,
      publicoAlvo: data.publicoAlvo ?? null,
      objetivoProjeto: data.objetivoProjeto ?? null,
      diferenciais: data.diferenciais ?? null,
      observacoesAnaliticas: data.observacoesAnaliticas ?? null,
      perfilPanel: data.perfilPanel ?? null,
      squad: data.squad ?? null,
      portalToken: randomUUID(),
    },
  });
}
