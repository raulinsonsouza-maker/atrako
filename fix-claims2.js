const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const page = await p.geoPage.findFirst({ where: { slug: "porque-registrar" } });
  if (!page) { console.error("Page not found"); process.exit(1); }
  await p.geoPage.update({
    where: { id: page.id },
    data: {
      answer: "Registrar a marca contribui para proteger a identidade do negócio e reduzir riscos de uso indevido por terceiros.",
      body: page.body.replace("garante exclusividade de uso", "contribui para a exclusividade de uso, sujeita à análise e concessão do INPI").replace("garante exclusividade", "contribui para a exclusividade"),
      updatedAt: new Date(),
    },
  });
  console.log("Updated porque-registrar");
  await p.$disconnect();
})();