const { PrismaClient } = require("@prisma/client");
const p = new PrismaClient();
(async () => {
  const site = await p.geoSite.findUnique({ where: { host: "lp.regicenter.com" } });
  if (!site) { console.error("Site not found"); process.exit(1); }
  console.log("site:", site.id);

  const facts = {
    brand: "Regicenter",
    legalName: "REGICENTER DO BRASIL LTDA",
    cnpj: "33.866.653/0001-07",
    foundedYear: 2012,
    description: "Empresa de proteção de marcas e patentes com atuação no Brasil e no exterior e rede de franquias.",
    offer: "Franquia de marcas e patentes",
    investment: { amount: 27900, currency: "BRL", label: "R$ 27.900,00", note: "Condições apresentadas pela equipe comercial na COF" },
    areaServed: "BR",
    contact: { email: "contato@regicenter.com", phone: "+55-800-789-0007", whatsapp: "+55-800-789-0007" },
    officialSite: "https://regicenter.com/",
    sameAs: ["https://regicenter.com/", "https://www.youtube.com/watch?v=mMRtrGFhIWg"],
    logo: "/lp/regicenter-franquia/assets/logo.png",
    image: "/lp/regicenter-franquia/assets/video.jpg",
    highlights: [
      "Desde 20 de agosto de 2012 no mercado de proteção de marcas",
      "18 unidades ativas (confirmado pelo cliente)",
      "Taxa de marketing: R$ 198,00/mês (15% do salário mínimo)",
      "Suporte jurídico e operacional incluso",
      "Treinamento comercial especializado",
      "Atuação internacional: USA, Europa, Canadá, México, Colômbia, Chile, Argentina, Índia, Inglaterra, Indonésia, Nova Zelândia, Austrália, China, Japão, África do Sul, Angola",
      "Marca registrada no INPI — Processo 928754464, concedido 02/04/2024, vigência até 02/04/2034",
    ],
    undisclosed: ["royalties", "taxa de franquia", "capital de giro", "prazo de retorno", "faturamento esperado"],
    undisclosedAnswer: "As condições completas são apresentadas pela equipe comercial na Circular de Oferta de Franquia (COF).",
    units: 18,
  };

  await p.geoSite.update({
    where: { id: site.id },
    data: { facts: JSON.stringify(facts), name: "Regicenter" },
  });
  console.log("Facts updated successfully.");

  // Update "150 unidades" references in pages
  const pages = await p.geoPage.findMany({ where: { siteId: site.id } });
  let updatedPages = 0;
  for (const pg of pages) {
    let body = pg.body || "";
    let faq = pg.faq || "";
    let changed = false;
    if (body.includes("150 unidades") || body.includes("mais de 150")) {
      body = body.replace(/mais de 150 unidades/g, "18 unidades ativas").replace(/150 unidades/g, "18 unidades ativas");
      changed = true;
    }
    if (faq.includes("150 unidades") || faq.includes("mais de 150")) {
      faq = faq.replace(/mais de 150 unidades/g, "18 unidades ativas").replace(/150 unidades/g, "18 unidades ativas");
      changed = true;
    }
    if (changed) {
      await p.geoPage.update({ where: { id: pg.id }, data: { body, faq, updatedAt: new Date() } });
      updatedPages++;
      console.log("Updated page:", pg.slug);
    }
  }
  console.log("Pages with '150 unidades' updated:", updatedPages);

  // Update FAQ confiavel
  const confiavelPage = pages.find(p => p.slug === "confiavel");
  if (confiavelPage) {
    const faq = JSON.parse(confiavelPage.faq || "[]");
    const newFaq = faq.map(f => {
      if (f.q && f.q.includes("confiável")) {
        return { ...f, a: "Atua desde 20 de agosto de 2012, com 18 unidades ativas no Brasil e suporte completo." };
      }
      return f;
    });
    await p.geoPage.update({ where: { id: confiavelPage.id }, data: { faq: newFaq, updatedAt: new Date() } });
    console.log("Updated confiavel FAQ");
  }

  await p.$disconnect();
  console.log("DONE");
})()