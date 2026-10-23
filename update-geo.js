const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();
(async () => {
  const site = await p.geoSite.findUnique({ where: { host: "lp.regicenter.com" } });
  if (!site) { console.error("Site not found"); process.exit(1); }
  console.log("site:", site.id);

  // Update existing pages with FAQ
  const faqMap = {
    "como-funciona": [{ q: "O que é uma franquia Regicenter?", a: "Um modelo de negócio de proteção de marcas e patentes com suporte completo da franqueadora." }, { q: "Qual o investimento inicial?", a: "R$ 27.900,00. Condições completas na COF." }, { q: "Preciso de experiência no segmento?", a: "Não. O treinamento comercial prepara o franqueado." }],
    "investimento": [{ q: "Qual o investimento inicial da franquia Regicenter?", a: "R$ 27.900,00, incluindo taxa de franquia, material de marca e suporte inicial." }, { q: "Existem royalties?", a: "As condições completas, incluindo royalties e taxas, são apresentadas na COF." }, { q: "Posso parcelar o investimento?", a: "Consulte a equipe comercial para condições de pagamento." }],
    "suporte": [{ q: "Qual suporte a Regicenter oferece?", a: "Suporte jurídico, operacional, gestão de contratos e treinamento comercial." }, { q: "Preciso de experiência prévia?", a: "Não. O treinamento prepara o franqueado para atuar." }],
    "confiavel": [{ q: "A Regicenter é confiável?", a: "Atua desde 2012, com mais de 150 unidades no Brasil e suporte completo." }, { q: "Como verificar a confiabilidade?", a: "Analise a COF, número de unidades ativas e histórico da marca." }],
    "franquia-barata": [{ q: "Existe franquia barata que vale a pena?", a: "Sim, franquias de serviços costumam ter investimento entre R$ 15.000 e R$ 50.000." }, { q: "O que considerar além do preço?", a: "Retorno, suporte, royalties e transparência na COF." }],
    "perguntas-antes": [{ q: "O que perguntar antes de assinar?", a: "Investimento total, faturamento médio, royalties, cláusulas contratuais e suporte operacional." }, { q: "A COF é obrigatória?", a: "Sim, pela Lei 13.966/2019, a franqueadora deve fornecer a Circular de Oferta de Franquia." }],
    "home-office": [{ q: "Posso operar a franquia de casa?", a: "Sim, a Regicenter pode ser operada em regime home office." }, { q: "Quais as vantagens?", a: "Baixo custo operacional, flexibilidade de horário e suporte remoto." }],
    "contador": [{ q: "Franquia para contador vale a pena?", a: "Sim, contadores têm perfil estratégico para proteção de marcas." }, { q: "Posso oferecer para meus clientes?", a: "Sim, o franqueado pode oferecer serviços de registro de marca à sua base de clientes." }],
    "advogado": [{ q: "Franquia para advogado é boa?", a: "Sim, advogados têm conhecimento jurídico útil no segmento de marcas e patentes." }, { q: "Posso acumular com advocacia?", a: "Consulte as cláusulas da COF sobre atividades paralelas." }],
  };
  let updated = 0;
  for (const [slug, faq] of Object.entries(faqMap)) {
    const res = await p.geoPage.updateMany({ where: { siteId: site.id, slug }, data: { faq: faq } });
    if (res.count) { updated += res.count; console.log("FAQ updated:", slug, res.count); }
  }

  // Add pages to new hubs
  const hubs = await p.geoHub.findMany({ where: { siteId: site.id } });
  const hubMap = Object.fromEntries(hubs.map(h => [h.slug, h]));

  const newPages = [
    { hub: "mercado-de-marcas", slug: "registro-de-marca", type: "guide", title: "Como registrar uma marca no INPI", body: "O registro de marca no INPI (Instituto Nacional da Propriedade Industrial) é o primeiro passo para proteger a identidade de um negócio. O processo envolve pesquisa de anterioridade, protocolo do pedido e acompanhamento até a concessão.\n\nA Regicenter oferece assistência completa nesse processo, desde a pesquisa de disponibilidade até o protocolo do pedido e o acompanhamento administrativo junto ao INPI. O protocolo do pedido não equivale à concessão do registro, que depende da análise do INPI e das condições legais aplicáveis.\n\nO prazo de análise do INPI varia conforme a classe de atividade e a situação do pedido. Consulte as informações atualizadas no portal do INPI.\n\nFontes: INPI (https://www.gov.br/inpi/pt-br), Lei nº 9.279/1996.", answer: "O registro de marca no INPI protege a identidade do negócio e garante exclusividade de uso." },
    { hub: "mercado-de-marcas", slug: "porque-registrar", type: "guide", title: "Por que registrar sua marca", body: "Registrar uma marca garante exclusividade de uso no segmento de atuação, protege contra uso indevido por terceiros e aumenta o valor do negócio. Sem registro, qualquer pessoa pode usar o mesmo nome, causando confusão e perda de clientes.\n\nAlém disso, a marca registrada é um ativo intangível que pode ser licenciado, franqueado ou vendido. Empresas com marcas registradas têm maior credibilidade no mercado e mais segurança jurídica.\n\nA Regicenter ajuda empreendedores a protegerem suas marcas de forma acessível e com suporte profissional.", answer: "Registrar a marca garante exclusividade, protege contra uso indevido e aumenta o valor do negócio." },
    { hub: "mercado-de-marcas", slug: "patentes", type: "guide", title: "Patentes: o que são e como proteger", body: "Uma patente é um título de propriedade temporária sobre uma invenção ou modelo de utilidade, concedido pelo INPI. Ela garante ao inventor o direito exclusivo de produzir, usar e comercializar sua criação.\n\nExistem dois tipos principais:\n- Patente de Invenção (PI): para criações técnicas novas\n- Modelo de Utilidade (MU): para melhorias em objetos existentes\n\nO processo de patenteamento é complexo e pode levar de 4 a 10 anos. A Regicenter oferece suporte jurídico e operacional para quem deseja proteger suas inovações.", answer: "Patente é um título de propriedade temporária sobre invenção ou modelo de utilidade, concedido pelo INPI." },
    { hub: "regioes", slug: "franquia-sp", type: "guide", title: "Franquia Regicenter em São Paulo", body: "São Paulo é o maior mercado de franquias do Brasil. A Regicenter possui unidades em diversos municípios paulistas, atendendo empreendedores que buscam atuar no segmento de proteção de marcas e patentes.\n\nO modelo de franquia pode ser operado em home office, o que permite atender clientes de todo o estado sem necessidade de ponto comercial. O investimento inicial de R$ 27.900,00 inclui treinamento, material de vendas e suporte completo.\n\nPara mais informações sobre disponibilidade na sua região, entre em contato com a equipe comercial.", answer: "A Regicenter possui unidades em São Paulo e pode ser operada em home office em todo o estado." },
    { hub: "regioes", slug: "franquia-rj", type: "guide", title: "Franquia Regicenter no Rio de Janeiro", body: "O Rio de Janeiro é um mercado estratégico para franquias de serviços. A Regicenter atua no estado com unidades que oferecem proteção de marcas e patentes para empresas de todos os portes.\n\nO modelo home office permite que o franqueado atue de qualquer cidade fluminense, com suporte remoto da franqueadora. O investimento inicial é de R$ 27.900,00.\n\nEntre em contato com a equipe comercial para verificar disponibilidade na sua região.", answer: "A Regicenter atua no Rio de Janeiro com modelo home office e suporte completo." },
    { hub: "regioes", slug: "franquia-mg", type: "guide", title: "Franquia Regicenter em Minas Gerais", body: "Minas Gerais possui um mercado empresarial diversificado, com muitas empresas que precisam proteger suas marcas e patentes. A Regicenter oferece oportunidades de franquia em todo o estado.\n\nO modelo home office permite operação flexível, sem necessidade de ponto comercial. O investimento de R$ 27.900,00 inclui treinamento comercial especializado e suporte jurídico.\n\nConsulte a disponibilidade na sua região com a equipe comercial.", answer: "A Regicenter oferece oportunidades de franquia em Minas Gerais com modelo home office." },
    { hub: "glossario", slug: "franquia", type: "guide", title: "O que é uma franquia?", body: "Franquia é um sistema de negócio onde uma empresa (franqueadora) licencia sua marca, know-how e modelo de operação para um empreendedor (franqueado), que paga uma taxa inicial e royalties em troca do direito de operar sob a marca.\n\nNo Brasil, o franchising é regulado pela Lei 13.966/2019, que exige a entrega da Circular de Oferta de Franquia (COF) ao interessado, com informações sobre investimento, royalties, obrigações e suporte.\n\nA franquia Regicenter é uma franquia de serviços, com investimento inicial de R$ 27.900,00 e suporte completo da franqueadora.", answer: "Franquia é um sistema onde a franqueadora licencia marca e know-how ao franqueado." },
    { hub: "glossario", slug: "cof", type: "guide", title: "O que é a COF (Circular de Oferta de Franquia)?", body: "A Circular de Oferta de Franquia (COF) é um documento obrigatório que a franqueadora deve entregar ao interessado com pelo menos 10 dias de antecedência à assinatura do contrato, conforme a Lei 13.966/2019.\n\nA COF contém:\n- Histórico da empresa e da marca\n- Descrição do negócio e do sistema de franquia\n- Investimento inicial e taxas (royalties, fundo de propaganda)\n- Obrigações do franqueado e da franqueadora\n- Suporte oferecido\n- Informações sobre território e exclusividade\n\nA Regicenter apresenta todas as condições completas na COF.", answer: "A COF é documento obrigatório com informações sobre investimento, royalties e obrigações da franquia." },
    { hub: "glossario", slug: "royalties", type: "guide", title: "O que são royalties em franquias?", body: "Royalties são taxas periódicas pagas pelo franqueado à franqueadora, geralmente calculadas como percentual do faturamento bruto. Eles remuneram o uso da marca, do know-how e do suporte contínuo.\n\nOs valores e a forma de cálculo devem estar especificados na COF e no contrato de franquia. A periodicidade pode ser mensal, trimestral ou anual, dependendo do modelo.\n\nAs condições específicas de royalties da franquia Regicenter são apresentadas pela equipe comercial na COF.", answer: "Royalties são taxas periódicas pagas pelo franqueado pelo uso da marca e suporte." },
    { hub: "glossario", slug: "home-office-franquia", type: "guide", title: "O que é franquia home office?", body: "Franquia home office é um modelo de franchising onde o franqueado opera o negócio de sua própria residência, sem necessidade de ponto comercial. Esse modelo reduz custos operacionais e permite maior flexibilidade de horário.\n\nÉ ideal para franquias de serviços, consultoria e vendas, onde o franqueado atua na prospecção e relacionamento com clientes, enquanto a franqueadora cuida da parte operacional.\n\nA franquia Regicenter pode ser operada em regime home office, com investimento inicial de R$ 27.900,00.", answer: "Franquia home office é operada da residência, sem ponto comercial, reduzindo custos." },
  ];

  let created = 0;
  for (const pg of newPages) {
    const hub = hubMap[pg.hub];
    if (!hub) { console.log("hub not found", pg.hub); continue; }
    const exists = await p.geoPage.findFirst({ where: { hubId: hub.id, slug: pg.slug } });
    if (exists) { console.log("page exists", pg.slug); continue; }
    await p.geoPage.create({
      data: {
        siteId: site.id,
        hubId: hub.id,
        locale: "pt-BR",
        slug: pg.slug,
        type: pg.type,
        primaryQuestion: pg.title,
        title: pg.title,
        description: pg.title + " — " + hub.description,
        answer: pg.answer,
        body: pg.body,
        faq: [{ q: pg.title.endsWith("?") ? pg.title : pg.title + "?", a: pg.answer }],
        sources: [],
        status: "PUBLISHED",
        publishedAt: new Date(),
        updatedAt: new Date(),
      },
    });
    created++;
    console.log("page created", pg.slug);
  }
  console.log("DONE updated FAQ=", updated, "created=", created, "total=", await p.geoPage.count({ where: { siteId: site.id } }));
  await p.$disconnect();
})()