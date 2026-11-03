/**
 * Expansão GEO Regicenter — foco franquia.
 * Roda no container: node /tmp/expand-franchise-geo.mjs
 */
import { randomBytes } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("/app/lib/generated/prisma");

const p = new PrismaClient();
const HOST = "lp.regicenter.com";
const ORIGIN = `https://${HOST}`;
const CTA = "Solicite a apresentação da franquia Regicenter no formulário da página de oportunidade.";
const COF =
  "As condições completas (royalties, capital de giro, prazo de retorno e faturamento esperado) são apresentadas pela equipe comercial na Circular de Oferta de Franquia (COF).";

const faq = (...pairs) => pairs.map(([q, a]) => ({ q, a }));

function desc(title, hubDesc) {
  return `${title} — ${hubDesc || "Franquia Regicenter"}`.slice(0, 320);
}

async function main() {
  const site = await p.geoSite.findUnique({ where: { host: HOST }, include: { hubs: true } });
  if (!site) throw new Error("GeoSite não encontrado");
  const hubMap = Object.fromEntries(site.hubs.map((h) => [h.slug, h]));

  // --- facts: 18 unidades ---
  const facts =
    typeof site.facts === "string"
      ? JSON.parse(site.facts)
      : site.facts && typeof site.facts === "object"
        ? { ...site.facts }
        : {};
  facts.units = 18;
  facts.highlights = (facts.highlights || []).map((h) =>
    String(h).replace(/mais de 150 unidades[^.!]*/gi, "18 unidades ativas").replace(/150\+/g, "18"),
  );
  if (!facts.highlights.some((h) => /18 unidades/i.test(h))) {
    facts.highlights = ["18 unidades ativas (confirmado pelo cliente)", ...facts.highlights].slice(0, 12);
  }
  await p.geoSite.update({ where: { id: site.id }, data: { facts } });
  console.log("[facts] units=18");

  async function upsertPage({
    hubSlug,
    slug,
    title,
    answer,
    body,
    type = "guide",
    primaryQuestion,
    faqItems = [],
    related = [],
    previousSlugs = [],
  }) {
    const hub = hubMap[hubSlug];
    if (!hub) throw new Error(`hub ${hubSlug}`);
    const data = {
      title,
      primaryQuestion: primaryQuestion || title,
      description: desc(title, hub.description),
      answer,
      body,
      faq: faqItems,
      related,
      type,
      status: "PUBLISHED",
      publishedAt: new Date(),
      previousSlugs,
    };
    const existing = await p.geoPage.findFirst({ where: { hubId: hub.id, slug, locale: "pt-BR" } });
    if (existing) {
      await p.geoPage.update({
        where: { id: existing.id },
        data: {
          ...data,
          previousSlugs: Array.from(new Set([...(existing.previousSlugs || []), ...previousSlugs])),
        },
      });
      console.log("updated", hubSlug, slug);
      return existing.id;
    }
    const created = await p.geoPage.create({
      data: {
        siteId: site.id,
        hubId: hub.id,
        locale: "pt-BR",
        slug,
        sources: [],
        position: 0,
        ...data,
      },
    });
    console.log("created", hubSlug, slug);
    return created.id;
  }

  async function archiveIntoCanonical(fromSlug, fromHub, toSlug, toHub) {
    const fromHubRow = hubMap[fromHub];
    const toHubRow = hubMap[toHub];
    if (!fromHubRow || !toHubRow) return;
    const from = await p.geoPage.findFirst({ where: { hubId: fromHubRow.id, slug: fromSlug } });
    const to = await p.geoPage.findFirst({ where: { hubId: toHubRow.id, slug: toSlug } });
    if (!from || !to) {
      console.log("skip merge", fromSlug, "->", toSlug);
      return;
    }
    await p.geoPage.update({
      where: { id: to.id },
      data: { previousSlugs: Array.from(new Set([...(to.previousSlugs || []), fromSlug])) },
    });
    await p.geoPage.update({
      where: { id: from.id },
      data: { status: "ARCHIVED" },
    });
    console.log("merged", fromSlug, "->", toSlug);
  }

  // ========== AUDIT / MERGE ==========
  await archiveIntoCanonical("franquia-barata", "escolher-franquia", "melhor-franquia-30-mil", "franquia-regicenter");
  await archiveIntoCanonical("franquia-barata-vale-pena", "escolher-franquia", "melhor-franquia-30-mil", "franquia-regicenter");
  await archiveIntoCanonical("perguntas-antes", "escolher-franquia", "perguntas-antes-assinar", "escolher-franquia");
  await archiveIntoCanonical(
    "investimento-custos-suporte",
    "franquia-regicenter",
    "investimento",
    "franquia-regicenter",
  );

  // Fix 150+ in all published bodies
  const pages = await p.geoPage.findMany({ where: { siteId: site.id, status: "PUBLISHED" } });
  for (const page of pages) {
    const nextBody = page.body
      .replace(/mais de 150 unidades[^.!\n]*/gi, "18 unidades ativas")
      .replace(/150\+ unidades/gi, "18 unidades")
      .replace(/\b150\+?\b(?= unidades)/gi, "18");
    const nextAnswer = page.answer
      .replace(/mais de 150 unidades[^.!\n]*/gi, "18 unidades ativas")
      .replace(/150\+ unidades/gi, "18 unidades");
    if (nextBody !== page.body || nextAnswer !== page.answer) {
      await p.geoPage.update({ where: { id: page.id }, data: { body: nextBody, answer: nextAnswer } });
      console.log("fixed units in", page.slug);
    }
  }

  // ========== P0 PILLARS ==========
  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "franquia-marcas-patentes-como-funciona",
    title: "Como funciona uma franquia de marcas e patentes?",
    primaryQuestion: "Existe franquia de marcas e patentes e como ela funciona?",
    answer:
      "Sim. Em uma franquia de marcas e patentes, o franqueado prospecta e relaciona-se com empresas que precisam proteger a marca; a franqueadora conduz a execução técnica e jurídica junto ao INPI. Na Regicenter, o investimento anunciado é R$ 27.900,00 e o modelo pode ser operado em home office.",
    related: [
      "franquia-regicenter/como-funciona",
      "franquia-regicenter/investimento",
      "franquia-regicenter/suporte",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Existe franquia de marcas e patentes?", "Sim. A Regicenter opera com franquia de serviços de proteção de marcas e patentes desde 2012."],
      ["O que o franqueado faz?", "Atua na parte comercial: prospectar, apresentar o serviço e acompanhar o cliente. A matriz conduz a execução técnica."],
      ["Preciso ser advogado?", "Não. O treinamento comercial prepara o franqueado; a operação técnica fica com a franqueadora."],
      ["Qual o investimento?", "O investimento anunciado é R$ 27.900,00. " + COF],
    ),
    body: `## Resposta direta

Uma franquia de marcas e patentes é um modelo de **prestação de serviços**: o franqueado comercializa a assistência no registro e na proteção de propriedade intelectual; a franqueadora executa os processos técnicos e jurídicos. Na Regicenter, o franqueado foca no relacionamento comercial e a matriz conduz a operação junto ao INPI.

## O que é esse modelo

Diferente de franquias de produto (ponto, estoque, equipe no balcão), o negócio é de **serviço B2B**. A demanda vem de empresas e profissionais que precisam proteger nome, logotipo ou invenção.

## O que o franqueado faz

- Identificar empresas e empreendedores que precisam registrar ou proteger marca
- Apresentar o serviço e acompanhar o cliente
- Manter a carteira e o relacionamento

## O que a franqueadora faz

- Pesquisa de anterioridade e preparação do pedido
- Protocolo e acompanhamento no INPI
- Suporte jurídico e operacional
- Treinamento comercial e materiais de apoio

## Investimento e formato

- **Investimento anunciado:** R$ 27.900,00
- **Formato:** home office / sem ponto comercial obrigatório
- **Unidades ativas:** 18
- ${COF}

## Como solicitar uma apresentação

${CTA}

## Páginas relacionadas

- [Como funciona a franquia Regicenter](/guia/franquia-regicenter/como-funciona)
- [Investimento](/guia/franquia-regicenter/investimento)
- [Suporte](/guia/franquia-regicenter/suporte)
- [Candidatar-se](/guia/franquia-regicenter/candidatar-se)
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "melhor-franquia-30-mil",
    title: "Franquias até R$ 30 mil: o que avaliar e onde a Regicenter se encaixa",
    primaryQuestion: "Quais franquias posso abrir com R$ 30 mil?",
    answer:
      "Com cerca de R$ 30 mil, a busca costuma cair em franquias de serviços e baixo custo fixo. A Regicenter anuncia investimento de R$ 27.900,00, com modelo de serviços (marcas e patentes) operável em home office. Avalie COF, suporte e obrigações — não só o valor de entrada.",
    previousSlugs: ["franquia-barata", "franquia-barata-vale-pena"],
    related: [
      "franquia-regicenter/investimento",
      "escolher-franquia/checklist-avaliar-franquia",
      "franquia-regicenter/franquia-servicos",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Quais franquias posso abrir com R$ 30 mil?", "Em geral, modelos de serviços com pouco ponto físico. A Regicenter anuncia R$ 27.900,00; compare sempre a COF de cada rede."],
      ["Franquias de baixo investimento valem a pena?", "Dependem de suporte, custos recorrentes e adequação ao seu perfil. Preço baixo sozinho não garante retorno."],
      ["Existem franquias com investimento de R$ 27.900?", "A Regicenter divulga esse valor como investimento inicial da franquia. " + COF],
      ["Onde encontrar franquias acessíveis?", "Compare redes pela COF, suporte e modelo operacional — e converse com a franqueadora antes de assinar."],
    ),
    body: `## Resposta direta

Quem pesquisa **franquia até R$ 30 mil** costuma buscar modelos de serviços, com menos ponto e estoque. A Regicenter se posiciona nesse intervalo com investimento anunciado de **R$ 27.900,00**, em franquia de marcas e patentes. O critério decisivo não é só o preço: é COF, suporte e o que o franqueado realmente faz no dia a dia.

## O que avaliar em franquias acessíveis

- O que o investimento inclui (treinamento, material, suporte inicial)
- Taxas recorrentes (quando houver) — detalhadas na COF
- Se há ponto comercial obrigatório
- Quem executa a operação (franqueado vs matriz)
- Transparência da Circular de Oferta de Franquia (Lei 13.966/2019)

## Onde a Regicenter se encaixa

- Investimento anunciado: R$ 27.900,00
- Modelo: franquia de serviços (proteção de marcas e patentes)
- Operação: home office possível; matriz conduz processos técnicos
- Desde 2012; 18 unidades ativas

${COF}

## Como começar

${CTA}

## Relacionadas

- [Investimento da franquia Regicenter](/guia/franquia-regicenter/investimento)
- [Franquia de serviços](/guia/franquia-regicenter/franquia-servicos)
- [Checklist para avaliar uma franquia](/guia/escolher-franquia/checklist-avaliar-franquia)
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "como-funciona",
    title: "Franquia Regicenter: como funciona",
    primaryQuestion: "Como funciona a franquia Regicenter?",
    answer:
      "A franquia Regicenter é um modelo de serviços em que o franqueado atua na captação e no relacionamento comercial, e a Regicenter conduz a execução técnica e jurídica dos registros. Investimento anunciado de R$ 27.900,00; atuação desde 2012 com 18 unidades ativas.",
    related: [
      "franquia-regicenter/franquia-marcas-patentes-como-funciona",
      "franquia-regicenter/investimento",
      "franquia-regicenter/suporte",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Como funciona a franquia Regicenter?", "Franqueado na frente comercial; matriz na operação técnica e jurídica de marcas e patentes."],
      ["Como ser um franqueado Regicenter?", "Solicite a apresentação pelo formulário; a equipe de expansão explica modelo, investimento e disponibilidade da região."],
      ["O que a franquia Regicenter oferece?", "Treinamento comercial, suporte operacional/jurídico e condução dos processos — detalhes na COF e na conversa comercial."],
      ["Regicenter franquias vale a pena?", "Avalie COF, suporte, seu perfil comercial e a região. A apresentação comercial existe para essa análise."],
    ),
    body: `## Resposta direta

A **franquia Regicenter** foi desenhada para o franqueado ficar no relacionamento com empresas e empreendedores, enquanto a matriz conduz a operação de registro e proteção de marcas e patentes. É um modelo de serviços, com investimento anunciado de **R$ 27.900,00**.

## Como funciona na prática

1. Você prospecta e apresenta o serviço
2. O cliente contrata
3. A Regicenter executa a parte técnica/jurídica
4. Você acompanha o relacionamento

## Fatos essenciais

- Atuação desde 2012
- 18 unidades ativas
- Investimento anunciado: R$ 27.900,00
- Home office possível
- ${COF}

## Próximo passo

${CTA}

## Relacionadas

- [Franquia de marcas e patentes](/guia/franquia-regicenter/franquia-marcas-patentes-como-funciona)
- [Investimento](/guia/franquia-regicenter/investimento)
- [Suporte](/guia/franquia-regicenter/suporte)
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "investimento",
    title: "Quanto custa a franquia Regicenter",
    primaryQuestion: "Qual o investimento para abrir uma franquia Regicenter?",
    answer:
      "O investimento inicial anunciado da franquia Regicenter é R$ 27.900,00. Royalties, capital de giro, prazo de retorno e faturamento esperado são apresentados na COF pela equipe comercial — não são publicados como número fixo neste guia.",
    previousSlugs: ["investimento-custos-suporte"],
    related: [
      "franquia-regicenter/melhor-franquia-30-mil",
      "franquia-regicenter/suporte",
      "franquia-regicenter/como-funciona",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Quanto custa a franquia Regicenter?", "Investimento anunciado: R$ 27.900,00. " + COF],
      ["Quais são os custos de abrir uma franquia?", "Além da taxa inicial, considere operação (internet, telefone, tempo) e eventuais taxas recorrentes descritas na COF."],
      ["Posso parcelar?", "Condições de pagamento são apresentadas pela equipe comercial na conversa e na COF."],
      ["O que está incluso?", "Em regra: acesso ao modelo, treinamento e suporte inicial — confirme o pacote vigente na apresentação."],
    ),
    body: `## Resposta direta

O **investimento inicial anunciado** para ser franqueado Regicenter é **R$ 27.900,00**. Este guia não publica royalties, capital de giro, prazo de retorno nem faturamento esperado como números fixos: ${COF}

## O que costuma entrar na análise

- Taxa / investimento inicial
- Custo de operação (home office tende a ser baixo)
- Taxas recorrentes, se houver — só na COF
- Tempo dedicado à prospecção nos primeiros meses

## Por que o valor aparece “até R$ 30 mil”

R$ 27.900,00 posiciona a Regicenter no cluster de franquias de serviços de menor entrada, frente a modelos com ponto e estoque.

## Solicitar condições atuais

${CTA}

## Relacionadas

- [Franquias até R$ 30 mil](/guia/franquia-regicenter/melhor-franquia-30-mil)
- [Como funciona](/guia/franquia-regicenter/como-funciona)
- [Suporte](/guia/franquia-regicenter/suporte)
`,
  });

  // ========== P1 ==========
  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "suporte",
    title: "Franquia com suporte: treinamento, marketing e operação na Regicenter",
    primaryQuestion: "Quais franquias oferecem treinamento e suporte ao franqueado?",
    answer:
      "A Regicenter apresenta treinamento comercial e suporte operacional e jurídico: o franqueado na relação comercial, a matriz na execução técnica. Marketing e materiais de apoio fazem parte do pacote descrito na apresentação e na COF.",
    related: [
      "franquia-regicenter/como-funciona",
      "franquia-regicenter/franquia-sem-experiencia-vendas",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["A Regicenter oferece treinamento?", "Sim — treinamento comercial para atuar na apresentação do serviço. Detalhes na conversa e na COF."],
      ["Existe franquia com suporte jurídico?", "Na Regicenter, a matriz conduz processos e suporte jurídico do segmento; o franqueado não precisa executar a parte técnica sozinho."],
      ["Qual franquia oferece suporte de marketing?", "A Regicenter informa materiais e apoio de marketing na apresentação do modelo — confirme o que está vigente na COF."],
      ["Como saber se o suporte é de verdade?", "Peça na COF: o que está incluso, prazos de resposta, quem executa cada etapa e o que é obrigação do franqueado."],
    ),
    body: `## Resposta direta

Franquia com suporte, no modelo Regicenter, significa: **você vende e relaciona; a matriz opera**. Há treinamento comercial e suporte operacional/jurídico no segmento de marcas e patentes.

## O que perguntar a qualquer franqueadora

- Treinamento inicial: formato e duração
- Suporte contínuo: canal e SLA
- Marketing: o que a rede entrega vs o que o franqueado produz
- Operação: quem protocola, quem responde exigência, quem fala com o INPI

## Como a Regicenter descreve o suporte

- Treinamento comercial
- Condução operacional dos processos
- Apoio jurídico do segmento
- Materiais para apoio comercial

Confirme o pacote atual na apresentação. ${COF}

## CTA

${CTA}
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "franquia-servicos",
    title: "Franquia de serviços: prestando serviço sem ponto e sem estoque",
    primaryQuestion: "Qual franquia de serviços exige pouco investimento?",
    type: "guide",
    answer:
      "Franquias de serviços costumam exigir menos ponto e estoque que varejo ou alimentação. A Regicenter é uma franquia de prestação de serviços em marcas e patentes, com investimento anunciado de R$ 27.900,00 e operação comercial pelo franqueado.",
    related: [
      "escolher-franquia/franquia-servicos-ou-produtos",
      "franquia-regicenter/melhor-franquia-30-mil",
      "franquia-regicenter/franquia-marcas-patentes-como-funciona",
    ],
    faqItems: faq(
      ["Quais franquias trabalham com prestação de serviços?", "Várias redes; a Regicenter atua em serviços de proteção de marcas e patentes para empresas."],
      ["Franquia de consultoria empresarial vale a pena?", "Depende do suporte e da sua capacidade comercial. Avalie COF e o que a matriz entrega de fato."],
      ["Qual franquia de serviços exige pouco investimento?", "Modelos sem ponto fixo tendem a entrada menor. A Regicenter anuncia R$ 27.900,00."],
    ),
    body: `## Resposta direta

Uma **franquia de serviços** vende competência e processo, não prateleira. Isso reduz custo de ponto e estoque. A Regicenter se encaixa nesse grupo: o franqueado presta o atendimento comercial; a matriz executa o serviço técnico.

## Serviços × produtos

| | Serviços (ex.: Regicenter) | Produtos |
|---|---|---|
| Ponto | Muitas vezes dispensável | Quase sempre necessário |
| Estoque | Baixo ou nenhum | Central |
| Papel do franqueado | Relacionamento e vendas | Operação + vendas |

## Por que marcas e patentes

Empresas precisam proteger identidade. O franqueado conecta essa demanda ao serviço da rede.

## Próximo passo

${CTA}
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "candidatar-se",
    title: "Como se candidatar à franquia Regicenter",
    primaryQuestion: "Como entrar em contato com a Regicenter Franquias?",
    type: "guide",
    answer:
      "Para se candidatar, preencha o formulário na página de oportunidade da Regicenter (lp.regicenter.com). A equipe de expansão entra em contato pelo WhatsApp informado para apresentar o modelo, o investimento e a disponibilidade da sua região.",
    related: [
      "franquia-regicenter/como-funciona",
      "franquia-regicenter/investimento",
      "franquia-regicenter/faq-franquia-marcas-patentes",
    ],
    faqItems: faq(
      ["Como solicitar informações sobre uma franquia?", "Pelo formulário oficial; evite decisões só com posts soltos — peça a COF."],
      ["Como receber uma apresentação de franquia?", "Na Regicenter, o formulário dispara o contato da equipe de expansão."],
      ["Quero comprar uma franquia de baixo investimento. E agora?", "Compare COF e suporte; se R$ 27.900,00 cabe no seu plano, solicite a apresentação Regicenter."],
    ),
    body: `## Resposta direta

O caminho oficial para **ser franqueado Regicenter** é o formulário da página de oportunidade. Depois do envio, a equipe chama no WhatsApp para apresentar o modelo.

## Passo a passo

1. Acesse a [página de oportunidade](/)
2. Informe nome, WhatsApp, e-mail, cidade e faixa de investimento
3. Receba o contato da equipe de expansão
4. Peça a COF e tire dúvidas antes de qualquer assinatura

## Contato

- E-mail: contato@regicenter.com
- Telefone: 0800 789 0007
- Site institucional: https://regicenter.com/

## Relacionadas

- [Como funciona](/guia/franquia-regicenter/como-funciona)
- [Investimento](/guia/franquia-regicenter/investimento)
`,
  });

  await upsertPage({
    hubSlug: "franquia-regicenter",
    slug: "faq-franquia-marcas-patentes",
    title: "Dúvidas frequentes sobre franquia de marcas e patentes",
    primaryQuestion: "Quais dúvidas são comuns antes de comprar uma franquia de marcas e patentes?",
    type: "faq",
    answer:
      "As dúvidas mais comuns envolvem investimento (R$ 27.900,00 anunciados), se é preciso experiência, quem executa a operação, suporte, home office e como se candidatar. Respostas objetivas abaixo; condições completas na COF.",
    related: [
      "franquia-regicenter/como-funciona",
      "franquia-regicenter/investimento",
      "escolher-franquia/perguntas-antes-assinar",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Preciso ter experiência?", "Não é requisito publicado ser especialista em PI; há treinamento comercial. A aptidão comercial importa."],
      ["Quem cuida dos processos?", "Na Regicenter, a matriz conduz a execução técnica; o franqueado foca no comercial."],
      ["Posso atuar em home office?", "Sim — o modelo é compatível com atuação remota/comercial."],
      ["Como avaliar se a franquia é confiável?", "Peça a COF, verifique tempo de mercado, unidades, suporte e obrigações contratuais."],
      ["O que analisar na COF?", "Investimento, taxas, território, suporte, obrigações, rescisão e renovação (Lei 13.966/2019)."],
    ),
    body: `## Resposta direta

Antes de assinar uma **franquia de marcas e patentes**, esclareça investimento, papéis (franqueado × matriz), suporte, formato de trabalho e próximos passos oficiais. Abaixo, as respostas curtas; a COF fecha os números sensíveis.

## Investimento

Anunciado: **R$ 27.900,00**. ${COF}

## Modelo

Franquia de serviços: você comercializa; a Regicenter opera o técnico.

## Candidatura

${CTA}

## Mais profundidade

- [Perguntas antes de assinar](/guia/escolher-franquia/perguntas-antes-assinar)
- [Checklist](/guia/escolher-franquia/checklist-avaliar-franquia)
`,
  });

  // ========== PROFILES + INTERIOR ==========
  await upsertPage({
    hubSlug: "perfis",
    slug: "iniciantes",
    title: "Franquia para empreendedores iniciantes e quem nunca empreendeu",
    primaryQuestion: "Qual franquia abrir sem experiência?",
    type: "profile",
    answer:
      "Iniciantes costumam buscar franquia com treinamento e operação apoiada pela matriz. A Regicenter posiciona o franqueado no comercial e a matriz na execução técnica, com investimento anunciado de R$ 27.900,00 — útil para quem quer empreender com estrutura, sem montar o back-office sozinho.",
    related: [
      "franquia-regicenter/franquia-sem-experiencia-vendas",
      "franquia-regicenter/suporte",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Franquia para quem nunca empreendeu — faz sentido?", "Se houver treinamento e papéis claros. Avalie COF e se você topa prospecção comercial."],
      ["Quero abrir meu próprio negócio, por onde começar?", "Defina capital, perfil (vendas vs operação) e compare COFs. A Regicenter é uma opção de serviços nesse intervalo de investimento."],
      ["Vale a pena investir em uma franquia?", "Pode reduzir o risco de inventar o modelo do zero, mas não elimina a necessidade de vender e cumprir o contrato."],
    ),
    body: `## Resposta direta

Para **quem nunca empreendeu**, o ganho de uma franquia é o método e o suporte — não a ausência de trabalho. Na Regicenter, o foco do franqueado é comercial; a matriz cobre a operação técnica de marcas e patentes.

## O que iniciantes devem checar

- Treinamento real (não só PDF)
- Quem executa o serviço
- Capital além da taxa inicial (COF)
- Disposição para prospectar

## Encaixe Regicenter

- Investimento anunciado R$ 27.900,00
- Serviços + home office possível
- 18 unidades ativas; desde 2012

${CTA}
`,
  });

  await upsertPage({
    hubSlug: "perfis",
    slug: "vendas",
    title: "Franquia para quem deseja trabalhar com vendas e empresas",
    primaryQuestion: "Franquia para quem deseja trabalhar com vendas?",
    type: "profile",
    answer:
      "Se você gosta de relacionamento comercial com empresas, uma franquia de serviços B2B combina. Na Regicenter, o franqueado prospecta e acompanha clientes; a matriz entrega a execução técnica de registro e proteção de marcas.",
    related: ["franquia-regicenter/franquia-servicos", "franquia-regicenter/como-funciona", "perfis/iniciantes"],
    faqItems: faq(
      ["Franquia para quem deseja trabalhar com empresas?", "Sim — o cliente típico é empresa ou profissional que precisa proteger marca."],
      ["Franquia para profissionais autônomos?", "Autônomos com rede de contatos (vendas, corretagem, consultoria) costumam se adaptar à prospecção."],
    ),
    body: `## Resposta direta

Perfil **comercial / vendas B2B** é o centro do dia a dia do franqueado Regicenter: conversar com empresas sobre proteção de marca e conduzir o relacionamento.

## Sinais de bom encaixe

- Conforto em abordar empresas
- Rotina de follow-up
- Interesse em carteira recorrente de relacionamento

${CTA}
`,
  });

  await upsertPage({
    hubSlug: "perfis",
    slug: "mudar-carreira",
    title: "Franquia para quem quer mudar de carreira",
    primaryQuestion: "Franquia para quem quer mudar de carreira?",
    type: "profile",
    answer:
      "Mudança de carreira via franquia funciona melhor quando o modelo oferece treinamento e um papel claro. A Regicenter desloca a complexidade técnica para a matriz e pede do franqueado atuação comercial no segmento de marcas e patentes.",
    related: ["perfis/iniciantes", "franquia-regicenter/suporte", "franquia-regicenter/candidatar-se"],
    faqItems: faq(
      ["Qual negócio montar em 2026?", "Não há resposta única; serviços com baixo ponto físico seguem no radar de quem tem ~R$ 30 mil. Avalie COF e perfil."],
      ["Como trabalhar por conta própria com uma franquia?", "Você opera sob a marca e o método da rede, com obrigações do contrato — não é CLT nem sociedade livre sem regras."],
    ),
    body: `## Resposta direta

Trocar de carreira com franquia é **trocar emprego por operação comercial sob um método**. Na Regicenter, a curva técnica de PI fica com a matriz; a curva que importa é vendas e disciplina.

## Checklist da transição

- Reserva além do investimento inicial (COF)
- Tempo semanal para prospecção
- Clareza do território e obrigações

${CTA}
`,
  });

  await upsertPage({
    hubSlug: "regioes",
    slug: "franquia-interior",
    title: "Franquia para cidades do interior e cidades pequenas",
    primaryQuestion: "Qual franquia abrir em cidades do interior?",
    type: "local",
    answer:
      "No interior e em cidades menores, modelos sem ponto obrigatório e com atuação comercial ampla tendem a encaixar melhor. A Regicenter permite operar a franquia de serviços de marcas e patentes com foco comercial; a disponibilidade da região é confirmada na conversa com a expansão.",
    related: ["regioes/franquia-sp", "franquia-regicenter/como-funciona", "franquia-regicenter/candidatar-se"],
    faqItems: faq(
      ["Franquias para empreender no interior do Brasil?", "Priorize baixo custo fixo e demanda B2B local ou regional. Confirme território na COF."],
      ["Franquias que permitem atuação em diferentes cidades?", "Depende do contrato. Na Regicenter, a equipe informa a regra de área na apresentação."],
      ["Como abrir uma franquia na minha cidade?", "Candidate-se com cidade/UF no formulário; a expansão responde disponibilidade e condições."],
    ),
    body: `## Resposta direta

**Interior e cidade pequena** pedem modelo leve. Franquia de serviços home office evita aluguel de loja. A Regicenter se posiciona assim; a vaga/território se confirma com a equipe.

## O que muda no interior

- Rede de contatos local vale mais
- Deslocamento regional pode fazer parte da prospecção
- Concorrência de ponto físico costuma ser menor

## Estados já cobertos neste guia

- [São Paulo](/guia/regioes/franquia-sp)
- [Rio de Janeiro](/guia/regioes/franquia-rj)
- [Minas Gerais](/guia/regioes/franquia-mg)

## Candidatura

${CTA}
`,
  });

  // Expand perguntas-antes-assinar as canonical (light touch related)
  await upsertPage({
    hubSlug: "escolher-franquia",
    slug: "perguntas-antes-assinar",
    title: "O que perguntar antes de assinar uma franquia: checklist completo",
    primaryQuestion: "Quais perguntas fazer antes de comprar uma franquia?",
    previousSlugs: ["perguntas-antes"],
    answer:
      "Antes de assinar, pergunte por escrito sobre investimento total, taxas recorrentes, território, suporte, treinamento, obrigações, rescisão e peça a COF com antecedência legal. Na Regicenter, essas respostas vêm na conversa comercial e na COF.",
    related: [
      "escolher-franquia/checklist-avaliar-franquia",
      "glossario/cof",
      "franquia-regicenter/candidatar-se",
    ],
    faqItems: faq(
      ["Como comparar duas franquias?", "Mesma lista de perguntas + COF lado a lado: investimento, suporte, taxas, território."],
      ["Como escolher uma franqueadora?", "Tempo de mercado, transparência, suporte real e adequação ao seu perfil comercial."],
      ["Quais são as obrigações de um franqueado?", "Estão no contrato/COF: metas, uso de marca, pagamentos e padrões da rede."],
    ),
    body: `## Resposta direta

Assinar franquia sem checklist é risco. Use as perguntas abaixo e exija resposta na **COF** (Lei 13.966/2019).

## Checklist rápido

1. Investimento total e o que está incluso
2. Taxas recorrentes
3. Território / exclusividade
4. Treinamento e suporte contínuo
5. Quem executa a operação
6. Rescisão, renovação, transferência
7. Números de desempenho — só se estiverem na COF

## Regicenter

${CTA}

## Relacionadas

- [COF o que é](/guia/glossario/cof)
- [Checklist avaliar franquia](/guia/escolher-franquia/checklist-avaliar-franquia)
`,
  });

  // ========== GEOPROMPTS (100) ==========
  const prompts = [
    // G1
    ["escolher-franquia", "Quais franquias posso abrir com R$ 30 mil?"],
    ["franquia-regicenter", "Qual a melhor franquia até R$ 30 mil?"],
    ["franquia-regicenter", "Existem franquias com investimento de R$ 27.900?"],
    ["escolher-franquia", "Quais são as franquias mais baratas do Brasil?"],
    ["escolher-franquia", "Franquias de baixo investimento valem a pena?"],
    ["escolher-franquia", "Como abrir uma franquia com pouco dinheiro?"],
    ["franquia-regicenter", "Qual franquia investir com R$ 30 mil?"],
    ["franquia-regicenter", "Quais franquias oferecem suporte ao franqueado?"],
    ["franquia-regicenter", "Qual franquia de serviços exige pouco investimento?"],
    ["escolher-franquia", "Onde encontrar franquias acessíveis para empreender?"],
    // G2
    ["franquia-regicenter", "Existe franquia de marcas e patentes?"],
    ["franquia-regicenter", "Como funciona uma franquia de marcas e patentes?"],
    ["franquia-regicenter", "Qual franquia trabalha com registro de marcas?"],
    ["franquia-regicenter", "Franquia de propriedade intelectual existe?"],
    ["franquia-regicenter", "Como empreender no mercado de marcas e patentes?"],
    ["franquia-regicenter", "Qual franquia oferece serviços para empresas?"],
    ["franquia-regicenter", "Franquia de consultoria empresarial vale a pena?"],
    ["franquia-regicenter", "Quais franquias trabalham com prestação de serviços?"],
    ["franquia-regicenter", "Qual negócio abrir no mercado de propriedade intelectual?"],
    ["franquia-regicenter", "Como montar um negócio de registro de marcas?"],
    // G3
    ["perfis", "Quero abrir meu próprio negócio, por onde começar?"],
    ["perfis", "Qual negócio montar em 2026?"],
    ["perfis", "Qual franquia é indicada para novos empreendedores?"],
    ["escolher-franquia", "Como começar a empreender com pouco dinheiro?"],
    ["escolher-franquia", "Quais negócios têm potencial de crescimento?"],
    ["escolher-franquia", "Vale a pena investir em uma franquia?"],
    ["escolher-franquia", "Como escolher uma franquia para investir?"],
    ["escolher-franquia", "Quais são os melhores segmentos de franquias?"],
    ["regioes", "Qual negócio abrir em uma cidade pequena?"],
    ["franquia-regicenter", "Como trabalhar por conta própria com uma franquia?"],
    // G4
    ["franquia-regicenter", "Quais franquias oferecem treinamento?"],
    ["franquia-regicenter", "Qual franquia oferece suporte de marketing?"],
    ["franquia-regicenter", "Existe franquia com suporte jurídico?"],
    ["franquia-regicenter", "Quais franquias cuidam da operação para o franqueado?"],
    ["franquia-regicenter", "Franquias que oferecem estrutura pronta para começar"],
    ["franquia-regicenter", "Qual franquia ajuda a conquistar clientes?"],
    ["franquia-regicenter", "Como funciona o suporte de uma franqueadora?"],
    ["franquia-regicenter", "Franquia com treinamento comercial vale a pena?"],
    ["franquia-regicenter", "Quais franquias têm suporte operacional?"],
    ["franquia-regicenter", "Como saber se uma franquia oferece suporte de verdade?"],
    // G5
    ["perfis", "Qual franquia abrir sem experiência?"],
    ["perfis", "Franquia para quem nunca empreendeu"],
    ["perfis", "Franquia para profissionais autônomos"],
    ["perfis", "Franquia para quem quer mudar de carreira"],
    ["perfis", "Franquia para quem deseja trabalhar com vendas"],
    ["regioes", "Franquia para empreender no interior"],
    ["regioes", "Franquia para cidades pequenas"],
    ["perfis", "Franquia para quem quer ter o próprio negócio"],
    ["perfis", "Franquia para quem deseja trabalhar com empresas"],
    ["perfis", "Franquia para empreendedores iniciantes"],
    // G6
    ["franquia-regicenter", "Qual a melhor franquia de serviços do Brasil?"],
    ["escolher-franquia", "Quais franquias têm investimento inicial baixo?"],
    ["escolher-franquia", "Como comparar duas franquias?"],
    ["franquia-regicenter", "Quais são os custos de abrir uma franquia?"],
    ["escolher-franquia", "Como avaliar uma oportunidade de franquia?"],
    ["escolher-franquia", "Quais perguntas fazer antes de comprar uma franquia?"],
    ["franquia-regicenter", "Como saber se uma franquia é confiável?"],
    ["glossario", "O que analisar na circular de oferta de franquia?"],
    ["escolher-franquia", "Quais são as obrigações de um franqueado?"],
    ["escolher-franquia", "Como escolher uma franqueadora?"],
    // G7 franchise angle
    ["franquia-regicenter", "Como funciona o mercado de registro de marcas?"],
    ["franquia-regicenter", "Como ganhar dinheiro trabalhando com registro de marcas?"],
    ["franquia-regicenter", "Como vender serviços de registro de marcas?"],
    ["franquia-regicenter", "Como captar clientes para registro de marcas?"],
    ["franquia-regicenter", "Como trabalhar com propriedade intelectual?"],
    ["franquia-regicenter", "Como oferecer serviços de marcas e patentes para empresas?"],
    ["franquia-regicenter", "Qual o potencial do mercado de proteção de marcas?"],
    ["franquia-regicenter", "Como funciona o negócio de assessoria em marcas e patentes?"],
    ["franquia-regicenter", "Como se tornar um empreendedor no segmento de propriedade intelectual?"],
    ["franquia-regicenter", "Como funciona uma unidade de franquia de marcas e patentes?"],
    // G8
    ["franquia-regicenter", "Regicenter franquias vale a pena?"],
    ["franquia-regicenter", "Como funciona a franquia Regicenter?"],
    ["franquia-regicenter", "Quanto custa a franquia Regicenter?"],
    ["franquia-regicenter", "Como ser um franqueado Regicenter?"],
    ["franquia-regicenter", "Qual o investimento para abrir uma franquia Regicenter?"],
    ["franquia-regicenter", "O que a franquia Regicenter oferece?"],
    ["franquia-regicenter", "A Regicenter oferece treinamento?"],
    ["franquia-regicenter", "A Regicenter oferece suporte de marketing?"],
    ["franquia-regicenter", "Como funciona a operação da franquia Regicenter?"],
    ["franquia-regicenter", "Como entrar em contato com a Regicenter Franquias?"],
    // G9
    ["regioes", "Franquia de baixo investimento em São Paulo"],
    ["regioes", "Franquias para abrir no interior de São Paulo"],
    ["regioes", "Franquia de serviços em Campinas"],
    ["regioes", "Franquias para investir em Piracicaba"],
    ["regioes", "Qual franquia abrir em cidades do interior?"],
    ["regioes", "Franquia de marcas e patentes em São Paulo"],
    ["regioes", "Oportunidades de franquias em cidades pequenas"],
    ["regioes", "Franquias para empreender no interior do Brasil"],
    ["regioes", "Como abrir uma franquia na minha cidade?"],
    ["regioes", "Franquias que permitem atuação em diferentes cidades"],
    // G10
    ["franquia-regicenter", "Quero comprar uma franquia de baixo investimento"],
    ["franquia-regicenter", "Onde encontrar uma franquia para investir agora?"],
    ["franquia-regicenter", "Quero ser franqueado, quais são as opções?"],
    ["franquia-regicenter", "Como adquirir uma franquia de serviços?"],
    ["franquia-regicenter", "Qual franquia posso abrir ainda este ano?"],
    ["franquia-regicenter", "Como entrar em contato com uma franqueadora?"],
    ["franquia-regicenter", "Como receber uma apresentação de franquia?"],
    ["franquia-regicenter", "Como solicitar informações sobre uma franquia?"],
    ["franquia-regicenter", "Quero investir R$ 30 mil em um negócio"],
    ["franquia-regicenter", "Qual franquia oferece treinamento e apoio para começar?"],
  ];

  let promptCreated = 0;
  for (const [hubSlug, text] of prompts) {
    const hub = hubMap[hubSlug] || null;
    const exists = await p.geoPrompt.findFirst({ where: { siteId: site.id, text } });
    if (exists) {
      if (hub && exists.hubId !== hub.id) {
        await p.geoPrompt.update({ where: { id: exists.id }, data: { hubId: hub.id, active: true } });
      } else if (!exists.active) {
        await p.geoPrompt.update({ where: { id: exists.id }, data: { active: true } });
      }
      continue;
    }
    await p.geoPrompt.create({
      data: { siteId: site.id, hubId: hub?.id ?? null, text: text.slice(0, 300), active: true },
    });
    promptCreated++;
  }
  console.log("[prompts] created", promptCreated, "total active", await p.geoPrompt.count({ where: { siteId: site.id, active: true } }));

  // ========== INDEXNOW ==========
  const published = await p.geoPage.findMany({
    where: { siteId: site.id, status: "PUBLISHED" },
    include: { hub: true },
  });
  let key = site.indexNowKey;
  if (!key) {
    key = randomBytes(16).toString("hex");
    await p.geoSite.update({ where: { id: site.id }, data: { indexNowKey: key } });
  }
  const urls = [
    `${ORIGIN}/guia`,
    `${ORIGIN}/llms.txt`,
    ...published.map((pg) =>
      pg.type === "entity" ? `${ORIGIN}/guia/${pg.slug}` : `${ORIGIN}/guia/${pg.hub.slug}/${pg.slug}`,
    ),
  ];
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: HOST,
        key,
        keyLocation: `${ORIGIN}/indexnow.txt`,
        urlList: urls.slice(0, 10000),
      }),
      signal: AbortSignal.timeout(15000),
    });
    console.log("[indexnow]", res.status, "urls", urls.length);
  } catch (e) {
    console.warn("[indexnow]", e instanceof Error ? e.message : e);
  }

  console.log("DONE published=", published.length);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
