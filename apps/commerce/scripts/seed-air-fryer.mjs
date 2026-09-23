import { PrismaClient } from "@prisma/client";
import fs from "fs";
import path from "path";

const prisma = new PrismaClient();

const PDF_RELATIVE =
  "Produtos/Simples-e-Saudáveis-Um-Guia-Completo-com-50-Receitas-na-Air-Fryer.pdf";
const PDF_NAME = "Simples-e-Saudaveis-50-Receitas-Air-Fryer.pdf";

const salesPage = {
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
    {
      q: "Posso pagar com PIX?",
      a: "Sim — e é o jeito mais rápido: confirma na hora e libera o download.",
    },
  ],
};

async function main() {
  const absolute = path.join(process.cwd(), PDF_RELATIVE);
  if (!fs.existsSync(absolute)) {
    throw new Error(`PDF não encontrado: ${absolute}`);
  }
  const sizeBytes = fs.statSync(absolute).size;

  const product = await prisma.product.upsert({
    where: { slug: "air-fryer-50-receitas" },
    update: {
      name: "Simples e Saudáveis — 50 Receitas na Air Fryer",
      description:
        "Guia completo com 50 receitas simples e saudáveis para Air Fryer. Acesso imediato em PDF.",
      type: "FILE",
      status: "PUBLISHED",
      priceCents: 1990,
      maxInstallments: 1,
      salesPage,
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
      salesPage,
      files: {
        create: [
          {
            name: PDF_NAME,
            key: `local://${PDF_RELATIVE}`,
            sizeBytes,
            mimeType: "application/pdf",
          },
        ],
      },
    },
  });

  const files = await prisma.productFile.findMany({ where: { productId: product.id } });
  if (files.length === 0) {
    await prisma.productFile.create({
      data: {
        productId: product.id,
        name: PDF_NAME,
        key: `local://${PDF_RELATIVE}`,
        sizeBytes,
        mimeType: "application/pdf",
      },
    });
  } else {
    await prisma.productFile.update({
      where: { id: files[0].id },
      data: {
        name: PDF_NAME,
        key: `local://${PDF_RELATIVE}`,
        sizeBytes,
        mimeType: "application/pdf",
      },
    });
  }

  console.log(
    JSON.stringify(
      {
        id: product.id,
        slug: product.slug,
        priceCents: product.priceCents,
        landing: `/p/${product.slug}`,
        checkout: `/checkout/${product.id}`,
      },
      null,
      2,
    ),
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
