/**
 * Script para listar Clientes e Contas de mídia (Google Ads e Meta).
 * Uso: npx tsx scripts/list-clientes-contas.ts
 */

import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({
    select: {
      id: true,
      nome: true,
      slug: true,
      ativo: true,
    },
    orderBy: { nome: "asc" },
  });

  const contas = await prisma.conta.findMany({
    select: {
      id: true,
      clienteId: true,
      plataforma: true,
      accountIdPlataforma: true,
      nomeConta: true,
    },
    orderBy: [{ clienteId: "asc" }, { plataforma: "asc" }],
  });

  console.log("\n========== 1. CLIENTES ==========\n");
  clientes.forEach((c) => {
    console.log(
      `id: ${c.id}\n  nome: ${c.nome}\n  slug: ${c.slug}\n  ativo: ${c.ativo}\n`
    );
  });

  console.log("\n========== 2. CONTAS ==========\n");
  contas.forEach((c) => {
    console.log(
      `id: ${c.id}\n  clienteId: ${c.clienteId}\n  plataforma: ${c.plataforma}\n  accountIdPlataforma: ${c.accountIdPlataforma ?? "-"}\n  nomeConta: ${c.nomeConta ?? "-"}\n`
    );
  });

  const clientesComGoogle = new Set(
    contas.filter((c) => c.plataforma.toUpperCase() === "GOOGLE_ADS").map((c) => c.clienteId)
  );
  const clientesComMeta = new Set(
    contas.filter((c) => c.plataforma.toUpperCase() === "META").map((c) => c.clienteId)
  );

  const comGoogle = clientes.filter((c) => clientesComGoogle.has(c.id));
  const comMeta = clientes.filter((c) => clientesComMeta.has(c.id));
  const comAmbos = clientes.filter(
    (c) => clientesComGoogle.has(c.id) && clientesComMeta.has(c.id)
  );
  const comNenhum = clientes.filter(
    (c) => !clientesComGoogle.has(c.id) && !clientesComMeta.has(c.id)
  );

  console.log("\n========== RESUMO ==========\n");
  console.log("Clientes com Google Ads:", comGoogle.map((c) => c.nome).join(", ") || "(nenhum)");
  console.log("Clientes com Meta Ads:  ", comMeta.map((c) => c.nome).join(", ") || "(nenhum)");
  console.log("Clientes com ambos:     ", comAmbos.map((c) => c.nome).join(", ") || "(nenhum)");
  console.log("Clientes com nenhum:    ", comNenhum.map((c) => c.nome).join(", ") || "(nenhum)");
  console.log("\n--- Contagens ---");
  console.log("  Com Google: ", comGoogle.length);
  console.log("  Com Meta:   ", comMeta.length);
  console.log("  Com ambos:  ", comAmbos.length);
  console.log("  Sem conta:  ", comNenhum.length);
  console.log("  Total:      ", clientes.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
