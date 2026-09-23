import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

async function main() {
  const clientes = await prisma.cliente.findMany({
    where: {
      OR: [
        { nome: { contains: "Beblue", mode: "insensitive" } },
        { nome: { contains: "Be Blue", mode: "insensitive" } },
        { slug: { contains: "beblue", mode: "insensitive" } },
        { slug: { contains: "be-blue", mode: "insensitive" } },
      ],
    },
    include: { contas: true },
  });
  console.log("Clientes Beblue/Be Blue encontrados:", clientes.length);
  clientes.forEach((c) => {
    console.log(
      JSON.stringify(
        {
          id: c.id,
          nome: c.nome,
          slug: c.slug,
          ativo: c.ativo,
          contas: c.contas.length,
        },
        null,
        2
      )
    );
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
