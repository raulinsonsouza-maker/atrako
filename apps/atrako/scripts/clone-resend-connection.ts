/**
 * Copia a WorkspaceConnection RESEND (credentialsEnc + domínio verificado) de um workspace
 * para outro, só trocando fromName. Não imprime a API key.
 *
 * Uso:
 *   npx tsx apps/atrako/scripts/clone-resend-connection.ts --from=regicenter --to=vilaris --fromName=Vilaris
 */

import { prisma } from "../lib/db";
import { Prisma } from "../lib/generated/prisma";

async function main() {
  const args = process.argv.slice(2);
  const fromSlug = args.find((a) => a.startsWith("--from="))?.slice(7) || "regicenter";
  const toSlug = args.find((a) => a.startsWith("--to="))?.slice(5);
  const fromName = args.find((a) => a.startsWith("--fromName="))?.slice(11) || toSlug || "Atrako";
  if (!toSlug) throw new Error("Informe --to=slug");

  const [fromCliente, toCliente] = await Promise.all([
    prisma.cliente.findFirst({ where: { slug: fromSlug }, select: { id: true, slug: true } }),
    prisma.cliente.findFirst({ where: { slug: toSlug }, select: { id: true, slug: true, nome: true } }),
  ]);
  if (!fromCliente) throw new Error(`Origem não encontrada: ${fromSlug}`);
  if (!toCliente) throw new Error(`Destino não encontrado: ${toSlug}`);

  const src = await prisma.workspaceConnection.findUnique({
    where: { clienteId_provider: { clienteId: fromCliente.id, provider: "RESEND" } },
  });
  if (!src || src.status !== "ACTIVE") throw new Error(`RESEND inativo em ${fromSlug}`);

  const meta = (src.metadata ?? {}) as Record<string, unknown>;
  if (!meta.fromEmail || meta.domainStatus !== "verified") {
    throw new Error(`Domínio Resend de ${fromSlug} não está verificado`);
  }

  const nextMeta = {
    ...meta,
    fromName,
    // Mantém o mesmo fromEmail/domínio verificado até o destino cadastrar o próprio domínio.
    clonedFrom: fromSlug,
  };

  await prisma.workspaceConnection.upsert({
    where: { clienteId_provider: { clienteId: toCliente.id, provider: "RESEND" } },
    create: {
      clienteId: toCliente.id,
      provider: "RESEND",
      status: "ACTIVE",
      label: "Resend",
      credentialsEnc: src.credentialsEnc as Prisma.InputJsonValue,
      metadata: nextMeta as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
    update: {
      status: "ACTIVE",
      label: "Resend",
      credentialsEnc: src.credentialsEnc as Prisma.InputJsonValue,
      metadata: nextMeta as Prisma.InputJsonValue,
      lastSyncedAt: new Date(),
    },
  });

  console.log(
    JSON.stringify(
      {
        ok: true,
        to: toCliente.slug,
        fromName,
        fromEmail: meta.fromEmail,
        domain: meta.domain,
        domainStatus: meta.domainStatus,
        note: "Remetente ainda usa o domínio verificado da origem até conectar o domínio próprio em /config/conexoes.",
      },
      null,
      2,
    ),
  );
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
