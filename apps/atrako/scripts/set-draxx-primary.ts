import { prisma } from "../lib/db";

async function main() {
  const cliente = await prisma.cliente.findUnique({ where: { slug: "draxx" } });
  if (!cliente) throw new Error("draxx not found");
  await prisma.workspaceSettings.upsert({
    where: { clienteId: cliente.id },
    create: { clienteId: cliente.id, primaryColor: "#cc0000" },
    update: { primaryColor: "#cc0000" },
  });
  console.log("primaryColor #cc0000 set for Draxx");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
