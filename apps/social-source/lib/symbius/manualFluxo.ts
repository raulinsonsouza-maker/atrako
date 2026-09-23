import { prisma } from "@/lib/db";
import { processAutomationForContato, startFluxoById } from "@/lib/instagram/automationEngine";

export async function triggerManualFluxo(params: {
  organizationId: string;
  fluxoId: string;
  contatoId: string;
  context?: Record<string, unknown>;
}): Promise<boolean> {
  const fluxo = await prisma.igFluxo.findFirst({
    where: {
      id: params.fluxoId,
      organizationId: params.organizationId,
      status: "PUBLISHED",
    },
  });
  if (!fluxo) return false;

  const contato = await prisma.igContato.findFirst({
    where: { id: params.contatoId, organizationId: params.organizationId },
  });
  if (!contato) return false;

  if (fluxo.triggerType === "manual" || fluxo.fluxoKind === "sequence") {
    await startFluxoById(
      fluxo.id,
      contato.id,
      params.organizationId,
      params.context ?? { manual: true },
    );
    return true;
  }

  await processAutomationForContato(
    params.organizationId,
    contato.igAccountId,
    contato.id,
    { ...(params.context ?? {}), manual: true, text: "" },
  );
  return true;
}

export async function triggerFluxosByTag(params: {
  organizationId: string;
  contatoId: string;
  tag: string;
}): Promise<void> {
  const contato = await prisma.igContato.findFirst({
    where: { id: params.contatoId, organizationId: params.organizationId },
  });
  if (!contato) return;

  const fluxos = await prisma.igFluxo.findMany({
    where: {
      organizationId: params.organizationId,
      status: "PUBLISHED",
      fluxoKind: "sequence",
      triggerType: "tag_entry",
    },
  });

  for (const fluxo of fluxos) {
    const cfg = fluxo.triggerConfig as Record<string, unknown>;
    const entryTag = String(cfg.entryTag ?? "");
    if (entryTag && entryTag === params.tag) {
      await startFluxoById(fluxo.id, contato.id, params.organizationId, {
        tagEntry: params.tag,
      });
      break;
    }
  }
}
