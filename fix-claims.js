const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const page = await p.geoPage.findFirst({ where: { slug: "registro-de-marca" } });
  if (!page) { console.error("Page not found"); process.exit(1); }

  const newBody = "O registro de marca no INPI (Instituto Nacional da Propriedade Industrial) é o primeiro passo para proteger a identidade de um negócio. O processo envolve pesquisa de anterioridade, protocolo do pedido e acompanhamento administrativo até a decisão do INPI.\n\nA Regicenter oferece assistência completa nesse processo, desde a pesquisa de disponibilidade até o protocolo do pedido e o acompanhamento administrativo junto ao INPI. O protocolo do pedido não equivale à concessão do registro, que depende da análise do INPI e das condições legais aplicáveis.\n\nO prazo de análise do INPI varia conforme a classe de atividade e a situação do pedido. Consulte as informações atualizadas no portal do INPI.\n\nFontes: INPI (https://www.gov.br/inpi/pt-br), Lei nº 9.279/1996.";

  const newAnswer = "A Regicenter oferece assistência no processo de registro de marca junto ao INPI, desde a pesquisa de disponibilidade até o protocolo e acompanhamento administrativo.";

  await p.geoPage.update({
    where: { id: page.id },
    data: {
      body: newBody,
      answer: newAnswer,
      updatedAt: new Date(),
    },
  });
  console.log("Updated:", page.slug);

  // Also fix the answer field in "porque-registrar" if it has absolute claims
  const page2 = await p.geoPage.findFirst({ where: { slug: "porque-registrar" } });
  if (page2) {
    console.log("Found porque-registrar, answer:", page2.answer);
  }

  await p.$disconnect();
})();