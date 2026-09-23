import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

async function main() {
  const email = (process.env.ADMIN_EMAIL || "admin@loja.com").toLowerCase();
  const password = process.env.ADMIN_PASSWORD || "admin123";
  const passwordHash = await bcrypt.hash(password, 10);

  await prisma.user.upsert({
    where: { email },
    update: { role: "ADMIN", passwordHash, name: "Admin" },
    create: {
      email,
      name: "Admin",
      role: "ADMIN",
      passwordHash,
    },
  });

  await prisma.paymentSettings.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", statementDescriptor: "SIGNAL" },
  });

  await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: {},
    create: { id: "default", pixelId: process.env.META_PIXEL_ID || null },
  });

  const demo = await prisma.product.upsert({
    where: { slug: "ebook-demo" },
    update: {},
    create: {
      name: "Ebook Demo Signal",
      slug: "ebook-demo",
      description: "Produto digital de demonstração para validar o checkout e a entrega.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 9700,
      maxInstallments: 6,
      salesPage: {
        headline: "Domine vendas digitais com um sistema completo",
        subheadline: "Do anúncio ao acesso do aluno — sem fricção.",
        bullets: [
          "Checkout transparente com cartão e PIX",
          "Área de membros pronta",
          "Pixel e CAPI para Meta Ads",
        ],
        faq: [
          { q: "Como recebo o acesso?", a: "Por e-mail assim que o pagamento for aprovado." },
          { q: "Posso parcelar?", a: "Sim, conforme configuração do produto." },
        ],
      },
      files: {
        create: [
          {
            name: "ebook-demo.pdf",
            key: "local://demo/ebook-demo.pdf",
            sizeBytes: 1024,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const airFryerPdf =
    "Produtos/Simples-e-Saudáveis-Um-Guia-Completo-com-50-Receitas-na-Air-Fryer.pdf";
  const airFryer = await prisma.product.upsert({
    where: { slug: "air-fryer-50-receitas" },
    update: {
      name: "Simples e Saudáveis — 50 Receitas na Air Fryer",
      description:
        "Guia completo com 50 receitas simples e saudáveis para Air Fryer. Acesso imediato em PDF.",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      metaPixelId: "3595042497343941",
      salesPage: {
        headline: "50 receitas simples e saudáveis na Air Fryer",
        subheadline:
          "Menos óleo, mais sabor e jantares prontos em minutos — um guia completo para transformar sua rotina na cozinha.",
        bullets: [
          "50 receitas práticas para o dia a dia",
          "Opções leves sem abrir mão do sabor",
          "Preparos rápidos pensados para Air Fryer",
          "Acesso imediato em PDF após o PIX",
          "Leve no celular, tablet ou computador",
        ],
        faq: [
          {
            q: "Como recebo o material?",
            a: "Assim que o PIX for confirmado, você recebe o acesso por e-mail e pode baixar o PDF na área de membros.",
          },
          {
            q: "Funciona em qualquer Air Fryer?",
            a: "Sim. As receitas usam tempos e temperaturas adaptáveis à maioria dos modelos.",
          },
          {
            q: "É pagamento único?",
            a: "Sim. Você paga R$ 19,90 uma vez e o guia fica seu.",
          },
        ],
      },
    },
    create: {
      name: "Simples e Saudáveis — 50 Receitas na Air Fryer",
      slug: "air-fryer-50-receitas",
      description:
        "Guia completo com 50 receitas simples e saudáveis para Air Fryer. Acesso imediato em PDF.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      metaPixelId: "3595042497343941",
      salesPage: {
        headline: "50 receitas simples e saudáveis na Air Fryer",
        subheadline:
          "Menos óleo, mais sabor e jantares prontos em minutos — um guia completo para transformar sua rotina na cozinha.",
        bullets: [
          "50 receitas práticas para o dia a dia",
          "Opções leves sem abrir mão do sabor",
          "Preparos rápidos pensados para Air Fryer",
          "Acesso imediato em PDF após o PIX",
          "Leve no celular, tablet ou computador",
        ],
        faq: [
          {
            q: "Como recebo o material?",
            a: "Assim que o PIX for confirmado, você recebe o acesso por e-mail e pode baixar o PDF na área de membros.",
          },
          {
            q: "Funciona em qualquer Air Fryer?",
            a: "Sim. As receitas usam tempos e temperaturas adaptáveis à maioria dos modelos.",
          },
          {
            q: "É pagamento único?",
            a: "Sim. Você paga R$ 19,90 uma vez e o guia fica seu.",
          },
        ],
      },
      files: {
        create: [
          {
            name: "Simples-e-Saudaveis-50-Receitas-Air-Fryer.pdf",
            key: `local://${airFryerPdf}`,
            sizeBytes: 21240980,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const airFryerFiles = await prisma.productFile.findMany({ where: { productId: airFryer.id } });
  if (airFryerFiles.length === 0) {
    await prisma.productFile.create({
      data: {
        productId: airFryer.id,
        name: "Simples-e-Saudaveis-50-Receitas-Air-Fryer.pdf",
        key: `local://${airFryerPdf}`,
        sizeBytes: 21240980,
        mimeType: "application/pdf",
      },
    });
  }

  const course = await prisma.product.upsert({
    where: { slug: "curso-demo" },
    update: {},
    create: {
      name: "Curso Demo Signal",
      slug: "curso-demo",
      description: "Curso de demonstração com módulos e aulas.",
      type: "COURSE",
      status: "PUBLISHED",
      priceCents: 19700,
      maxInstallments: 12,
      salesPage: {
        headline: "Curso completo para vender online",
        subheadline: "Aulas práticas na área de membros.",
        bullets: ["Módulos organizados", "Progresso salvo", "Player embutido"],
        faq: [],
      },
      modules: {
        create: [
          {
            title: "Começando",
            position: 1,
            lessons: {
              create: [
                {
                  title: "Boas-vindas",
                  position: 1,
                  content: "Bem-vindo ao curso demo.",
                  bunnyVideoId: "",
                },
                {
                  title: "Como usar a plataforma",
                  position: 2,
                  content: "Navegue pelos módulos e marque o progresso.",
                },
              ],
            },
          },
        ],
      },
    },
  });

  await prisma.offer.upsert({
    where: { id: "demo-bump" },
    update: {},
    create: {
      id: "demo-bump",
      triggerProductId: demo.id,
      offeredProductId: course.id,
      type: "ORDER_BUMP",
      discountPercent: 20,
      headline: "Leve o Curso Demo com 20% off",
      description: "Complemente o ebook com o curso completo.",
      position: 1,
      active: true,
    },
  });

  await prisma.offer.upsert({
    where: { id: "demo-upsell" },
    update: {},
    create: {
      id: "demo-upsell",
      triggerProductId: demo.id,
      offeredProductId: course.id,
      type: "POST_PURCHASE",
      discountPercent: 30,
      headline: "Oferta exclusiva pós-compra",
      description: "Adicione o curso agora com desconto especial.",
      position: 1,
      active: true,
    },
  });

  await prisma.coupon.upsert({
    where: { code: "SINAL10" },
    update: {},
    create: {
      code: "SINAL10",
      type: "PERCENT",
      value: 10,
      maxUses: 100,
      active: true,
    },
  });

  const plantasPdf = "Produtos/Plantas-Medicinal/Tratado-das-Plantas-Medicinais.pdf";
  const plantas = await prisma.product.upsert({
    where: { slug: "plantas-medicinais" },
    update: {
      name: "Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas",
      description:
        "E-book completo para conhecer plantas medicinais, formas de preparo, partes utilizadas, aplicações, toxicidade e contraindicações. Acesso imediato em PDF.",
      status: "PUBLISHED",
      priceCents: 2990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-plantas.png",
      salesPage: {
        headline: "As plantas podem fazer parte da sua rotina. O conhecimento sobre elas também.",
        subheadline:
          "Conheça melhor as plantas medicinais, suas formas de preparo, partes utilizadas, aplicações, toxicidade e contraindicações em um único guia.",
        bullets: [
          "Plantas medicinais nativas ou cultivadas em Minas Gerais",
          "Formas de preparo e partes utilizadas",
          "Aplicações, toxicidade e contraindicações",
          "Ilustrações em aquarela de artistas mineiros",
          "Acesso imediato em PDF após o PIX",
        ],
        faq: [
          {
            q: "O que vou receber?",
            a: "Você receberá o e-book digital Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas.",
          },
          {
            q: "Posso ler pelo celular?",
            a: "Sim. O material é digital e pode ser consultado em dispositivos compatíveis com o formato disponibilizado.",
          },
          {
            q: "É um livro para substituir tratamento médico?",
            a: "Não. O material é educativo e não substitui diagnóstico, tratamento ou orientação de profissionais de saúde.",
          },
        ],
      },
    },
    create: {
      name: "Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas",
      slug: "plantas-medicinais",
      description:
        "E-book completo para conhecer plantas medicinais, formas de preparo, partes utilizadas, aplicações, toxicidade e contraindicações. Acesso imediato em PDF.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 2990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-plantas.png",
      salesPage: {
        headline: "As plantas podem fazer parte da sua rotina. O conhecimento sobre elas também.",
        subheadline:
          "Conheça melhor as plantas medicinais, suas formas de preparo, partes utilizadas, aplicações, toxicidade e contraindicações em um único guia.",
        bullets: [
          "Plantas medicinais nativas ou cultivadas em Minas Gerais",
          "Formas de preparo e partes utilizadas",
          "Aplicações, toxicidade e contraindicações",
          "Ilustrações em aquarela de artistas mineiros",
          "Acesso imediato em PDF após o PIX",
        ],
        faq: [
          {
            q: "O que vou receber?",
            a: "Você receberá o e-book digital Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas.",
          },
          {
            q: "Posso ler pelo celular?",
            a: "Sim. O material é digital e pode ser consultado em dispositivos compatíveis com o formato disponibilizado.",
          },
          {
            q: "É um livro para substituir tratamento médico?",
            a: "Não. O material é educativo e não substitui diagnóstico, tratamento ou orientação de profissionais de saúde.",
          },
        ],
      },
      files: {
        create: [
          {
            name: "Tratado-das-Plantas-Medicinais.pdf",
            key: `local://${plantasPdf}`,
            sizeBytes: 100993134,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const plantasFiles = await prisma.productFile.findMany({ where: { productId: plantas.id } });
  if (plantasFiles.length === 0) {
    await prisma.productFile.create({
      data: {
        productId: plantas.id,
        name: "Tratado-das-Plantas-Medicinais.pdf",
        key: `local://${plantasPdf}`,
        sizeBytes: 100993134,
        mimeType: "application/pdf",
      },
    });
  }

  const bolosPdf = "Produtos/Bolos/Os-100-melhores-bolos.pdf";
  const bolos = await prisma.product.upsert({
    where: { slug: "100-melhores-bolos" },
    update: {
      name: "Os 100 Melhores Bolos",
      description:
        "E-book com 100 receitas de bolos caseiros, fáceis e testadas. Acesso imediato em PDF.",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-bolos.png",
      metaPixelId: "3595042497343941",
      salesPage: {
        headline: "100 bolos deliciosos, fáceis e testados. Para fazer em casa hoje.",
        subheadline:
          "Receitas caseiras prontas para assar: simples, gostosas e com ingredientes de mercado.",
        bullets: [
          "100 receitas de bolos",
          "Passo a passo fácil",
          "Receitas testadas",
          "Ingredientes de casa",
          "Acesso imediato após o PIX",
        ],
        faq: [
          {
            q: "O que eu recebo?",
            a: "O e-book digital Os 100 Melhores Bolos, com acesso na hora.",
          },
          {
            q: "Dá para ler no celular?",
            a: "Sim. No celular, no tablet ou no computador.",
          },
          {
            q: "As receitas são fáceis?",
            a: "Sim. Foram pensadas para o dia a dia, com preparo simples.",
          },
        ],
      },
    },
    create: {
      name: "Os 100 Melhores Bolos",
      slug: "100-melhores-bolos",
      description:
        "E-book com 100 receitas de bolos caseiros, fáceis e testadas. Acesso imediato em PDF.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      coverUrl: "/produtos/capa-bolos.png",
      metaPixelId: "3595042497343941",
      salesPage: {
        headline: "100 bolos deliciosos, fáceis e testados. Para fazer em casa hoje.",
        subheadline:
          "Receitas caseiras prontas para assar: simples, gostosas e com ingredientes de mercado.",
        bullets: [
          "100 receitas de bolos",
          "Passo a passo fácil",
          "Receitas testadas",
          "Ingredientes de casa",
          "Acesso imediato após o PIX",
        ],
        faq: [
          {
            q: "O que eu recebo?",
            a: "O e-book digital Os 100 Melhores Bolos, com acesso na hora.",
          },
          {
            q: "Dá para ler no celular?",
            a: "Sim. No celular, no tablet ou no computador.",
          },
          {
            q: "As receitas são fáceis?",
            a: "Sim. Foram pensadas para o dia a dia, com preparo simples.",
          },
        ],
      },
      files: {
        create: [
          {
            name: "Os-100-melhores-bolos.pdf",
            key: `local://${bolosPdf}`,
            sizeBytes: 4239479,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const bolosFiles = await prisma.productFile.findMany({ where: { productId: bolos.id } });
  if (bolosFiles.length === 0) {
    await prisma.productFile.create({
      data: {
        productId: bolos.id,
        name: "Os-100-melhores-bolos.pdf",
        key: `local://${bolosPdf}`,
        sizeBytes: 4239479,
        mimeType: "application/pdf",
      },
    });
  }

  console.log("Seed OK:", {
    admin: email,
    demo: demo.slug,
    airFryer: airFryer.slug,
    plantas: plantas.slug,
    bolos: bolos.slug,
    course: course.slug,
  });
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
