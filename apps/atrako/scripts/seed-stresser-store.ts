/**
 * Workspace Stresser Colchões (ecommerce) + oferta Pikolin Mood.
 *
 *   npx tsx scripts/seed-stresser-store.ts
 *
 * Login: vendas@stressercolchoes.com.br / Stresser@2026
 * LP:    https://lp.stressercolchoes.com.br/  (= /p/pikolin-mood)
 * Painel: /commerce · /crm · dashboard
 */

import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";
import { ensureDefaultPipeline, applyPipelinePreset } from "../lib/modules/crm";
import { applyWorkspaceEdition } from "../lib/modules/apply-edition";
import { defaultShippingRules, type ShippingRules } from "../lib/commerce/shipping";
import { Prisma } from "../lib/generated/prisma";
import {
  PLATAFORMA_GOOGLE_ADS,
  PLATAFORMA_META,
  PLATAFORMA_GOOGLE_ANALYTICS,
} from "../lib/repositories/contasRepository";

const EMAIL = process.env.STRESSER_OWNER_EMAIL?.trim() || "vendas@stressercolchoes.com.br";
const PASSWORD = process.env.STRESSER_OWNER_PASSWORD?.trim() || "Stresser@2026";
const SLUG = "stresser";
const LOGO = "/lp/stresser/assets/logo.webp";
/** Verde vivo do emblema Stresser (lime). */
const PRIMARY = "#8BC34A";
const PRODUCT_SLUG = "pikolin-mood";
const PIX_DISCOUNT_PERCENT = 15;
const GALLERY_MAIN = "/lp/stresser/assets/gallery/colchao-pikolin-mood.webp";
const GALLERY_TAMPO = "/lp/stresser/assets/gallery/colchao-pikolin-mood-tampo.webp";
const VIDEO_SRC = "/lp/stresser/assets/Pikolin_mood.mp4";
const TRAY_COVER =
  "https://images.tcdn.com.br/img/img_prod/1326584/colcho_pikolin_mood_molas_ensacadas_firme_1_20260809204941_aed1f7947fea.png";

const VARIANTS = [
  { label: "Solteiro Padrão (0,88m x 1,88m)", sku: "MOOD-SOL", priceCents: 299900, stockQty: 20 },
  { label: "Solteiro Americano (0,96m x 2,03m)", sku: "MOOD-SOL-AM", priceCents: 319900, stockQty: 20 },
  { label: "Casal Padrão (1,38m x 1,88m)", sku: "MOOD-CAS", priceCents: 299900, stockQty: 30 },
  { label: "Queen Size (1,58m x 1,98m)", sku: "MOOD-QUEEN", priceCents: 349900, stockQty: 20 },
  { label: "King Size (1,93m x 2,03m)", sku: "MOOD-KING", priceCents: 399900, stockQty: 15 },
] as const;

function shippingFreeBrasil(): ShippingRules {
  return {
    ...defaultShippingRules(),
    pickupEnabled: false,
    shipEnabled: true,
    freeShippingMinCents: 1,
    defaultFeeCents: 0,
    defaultDaysMin: 15,
    defaultDaysMax: 25,
    zones: [],
  };
}

function moodSalesPage(): Prisma.InputJsonValue {
  return {
    goal: "sales",
    version: 1,
    pixDiscountPercent: PIX_DISCOUNT_PERCENT,
    sections: [
      {
        id: "s_hero",
        type: "hero",
        headline: "Pikolin Mood — firmeza que segura a noite inteira",
        subheadline: "Molas ensacadas Cross System · Cool Touch · altura 28 cm",
      },
      {
        id: "s_gallery",
        type: "gallery",
        images: [
          {
            src: VIDEO_SRC,
            alt: "Vídeo Pikolin Mood",
            kind: "video",
            poster: GALLERY_TAMPO,
          },
          { src: GALLERY_MAIN, alt: "Colchão Pikolin Mood — vista principal", kind: "image" },
          { src: GALLERY_TAMPO, alt: "Colchão Pikolin Mood — tampo Copper Fabric", kind: "image" },
          { src: TRAY_COVER, alt: "Colchão Pikolin Mood Molas Ensacadas Firme", kind: "image" },
        ],
      },
      {
        id: "s_layers",
        type: "mattress_layers",
        title: "Do que o nosso colchão é composto",
        layers: [
          {
            id: 1,
            title: "Tecido Copper Fabric",
            imageUrl: "/lp/stresser/assets/layers/01-tampo-mood.png",
            body: "Tecido altamente tecnológico, com fios especiais que captam a temperatura do ambiente e refletem o calor, sem absorvê-lo. A sensação de frescor é permanente, dissipando a transpiração. O resultado é um colchão sempre fresco e seco, livre de ácaros e muito confortável. Também adquire as propriedades curativas e medicinais do cobre, proporcionando renovação celular e capacidades antibacterianas e antifúngicas, já comprovadas cientificamente em laboratório.",
          },
          {
            id: 2,
            title: "Fibra Siliconada",
            imageUrl: "/lp/stresser/assets/layers/02-fibra-siliconada.png",
          },
          {
            id: 3,
            title: "Espuma Cool Touch",
            imageUrl: "/lp/stresser/assets/layers/03-cool-touch.png",
          },
          {
            id: 4,
            title: "Tecido Retentor",
            imageUrl: "/lp/stresser/assets/layers/04-tecido-retentor.png",
          },
          {
            id: 5,
            title: "Espuma High Support",
            imageUrl: "/lp/stresser/assets/layers/05-high-support.png",
            body: "Espuma de alta resiliência e expansão controlada, oferece conforto e suporte ao mesmo tempo. Suas características mantêm os músculos relaxados e a coluna alinhada, evitando dores nas costas e articulações e promovendo um sono regenerador.",
          },
          {
            id: 6,
            title: "Non-woven",
            imageUrl: "/lp/stresser/assets/layers/06-non-woven.png",
          },
          {
            id: 7,
            title: "Molas Cross System",
            imageUrl: "/lp/stresser/assets/layers/07-molas-cross-system.png",
            body: "O molejo Cross System possui o terço central reforçado, criando três zonas distintas que permitem uma melhor adaptação do colchão à sua coluna vertebral. Todo esse reforço é combinado com as vantagens de um sistema de molas ensacadas – facilidade de movimento sobre o colchão, diminuição de ruídos e maciez. Cross System proporciona mais suporte para a região lombar do corpo em um total de 250kg — o maior suporte comprovado em molas ensacadas do mercado. A sensação de alívio de pressão versus a sensação de suporte é progressiva, reduzindo uma enquanto aumenta a outra, de produto para produto. Testado pelo Centro Tecnológico de Controle de Qualidade Falcão Bauer. Teste de ciclo garante o uso pleno para biotipo de até 250 quilos.*",
          },
          {
            id: 8,
            title: "Non-woven",
            imageUrl: "/lp/stresser/assets/layers/08-non-woven.png",
          },
          {
            id: 9,
            title: "Borda Air Flow Support",
            imageUrl: "/lp/stresser/assets/layers/09-borda-air-flow.png",
          },
          {
            id: 10,
            title: "Espuma de Suporte",
            imageUrl: "/lp/stresser/assets/layers/10-suporte.png",
          },
          {
            id: 11,
            title: "Tecido Antiderrapante",
            imageUrl: "/lp/stresser/assets/layers/11-tecido-antiderrapante.png",
          },
        ],
      },
      {
        id: "s_benefits",
        type: "benefits",
        title: "Tecnologia que você sente",
        lead: "Suporte ortopédico, frescor e durabilidade — sem enrolação.",
        items: [
          {
            icon: "◎",
            title: "Cross System",
            body: "Molas ensacadas com reforço lombar. Sem transferência de movimento. Até 250 kg.",
          },
          {
            icon: "❄",
            title: "Cool Touch",
            body: "Toque fresco que dissipa calor — ideal para noites quentes.",
          },
          {
            icon: "◈",
            title: "Copper Fabric",
            body: "Fios de cobre: antiácaro, antimicrobiano e sensação térmica agradável.",
          },
          {
            icon: "△",
            title: "High Support",
            body: "Espuma de alta resiliência: coluna alinhada e firmeza real.",
          },
          {
            icon: "⇄",
            title: "Air Flow",
            body: "Borda ventilada que mantém o colchão arejado e estável.",
          },
          {
            icon: "✓",
            title: "Frete + garantia",
            body: "Frete grátis Brasil · 1 ano de garantia · ~20 dias úteis.",
          },
        ],
      },
      {
        id: "s_faq",
        type: "faq",
        title: "Dúvidas rápidas",
        items: [
          {
            q: "Quais medidas?",
            a: "Solteiro Padrão, Solteiro Americano, Casal, Queen e King — escolha no checkout.",
          },
          {
            q: "Frete é grátis?",
            a: "Sim, para todo o Brasil. Disponibilidade típica em cerca de 20 dias úteis.",
          },
          {
            q: "Pix ou cartão?",
            a: "Pix com 15% off ou cartão em até 10x sem juros.",
          },
          {
            q: "É firme mesmo?",
            a: "Sim. Mood é firme: molas ensacadas + High Support para quem quer suporte forte.",
          },
        ],
      },
      { id: "s_checkout", type: "checkout" },
    ],
  };
}

async function upsertCliente() {
  const existing = await prisma.cliente.findFirst({
    where: {
      OR: [{ slug: SLUG }, { nome: { contains: "stresser", mode: "insensitive" } }],
    },
  });
  const data = {
    nome: "Stresser Colchões",
    slug: SLUG,
    ativo: true,
    logoUrl: LOGO,
    segmento: "Colchões / e-commerce",
    objetivoMidia: "ecommerce",
    perfilPanel: "ecommerce",
    produtoServico: "Colchões, camas box, travesseiros e sofás-cama — campanhas Google com LP de alta conversão.",
    modeloNegocio: "Loja física/online (Tray) + páginas de oferta Atrako para mídia paga.",
    publicoAlvo: "Quem busca colchão firme com boa relação custo-benefício, frete grátis e parcelamento.",
    objetivoProjeto: "Vender o Pikolin Mood via LP com checkout Mercado Pago e medir conversão no Google Ads.",
  };
  if (existing) return prisma.cliente.update({ where: { id: existing.id }, data });
  return prisma.cliente.create({ data });
}

async function upsertOwner(clienteId: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const existing = await prisma.workspaceMember.findFirst({ where: { email: EMAIL } });
  if (existing) {
    return prisma.workspaceMember.update({
      where: { id: existing.id },
      data: {
        clienteId,
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Stresser Colchões",
      },
    });
  }
  return prisma.workspaceMember.create({
    data: {
      clienteId,
      email: EMAIL,
      name: "Stresser Colchões",
      role: "OWNER",
      active: true,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}

async function ensureContas(clienteId: string) {
  for (const plataforma of [PLATAFORMA_GOOGLE_ADS, PLATAFORMA_META, PLATAFORMA_GOOGLE_ANALYTICS]) {
    const existing = await prisma.conta.findFirst({ where: { clienteId, plataforma } });
    if (existing) {
      await prisma.conta.update({
        where: { id: existing.id },
        data: { nomeConta: "Stresser Colchões" },
      });
      continue;
    }
    await prisma.conta.create({
      data: {
        clienteId,
        plataforma,
        nomeConta: "Stresser Colchões",
        accountIdPlataforma: null,
      },
    });
  }
}

async function seedStore(clienteId: string) {
  const rules = shippingFreeBrasil();
  const theme = {
    logoUrl: LOGO,
    announce: "Frete grátis Brasil · 15% off no Pix · 10x sem juros",
    about: "Stresser Colchões — qualidade em colchões com entrega em todo o Brasil.",
    whatsapp: "41999962142",
    email: "vendas@stressercolchoes.com.br",
    hours: "09:00 às 18:00",
    instagram: "",
    pixDiscountPercent: PIX_DISCOUNT_PERCENT,
  };

  let store = await prisma.commerceStore.findUnique({ where: { clienteId } });
  if (!store) {
    store = await prisma.commerceStore.create({
      data: {
        clienteId,
        slug: SLUG,
        name: "Stresser Colchões",
        published: true,
        acceptingOrders: true,
        shipEnabled: true,
        pickupEnabled: false,
        minOrderCents: 0,
        shippingRules: rules,
        theme,
      },
    });
  } else {
    store = await prisma.commerceStore.update({
      where: { id: store.id },
      data: {
        slug: SLUG,
        name: "Stresser Colchões",
        published: true,
        acceptingOrders: true,
        shipEnabled: true,
        pickupEnabled: false,
        shippingRules: rules,
        theme,
      },
    });
  }

  const category = await prisma.commerceCategory.upsert({
    where: { storeId_slug: { storeId: store.id, slug: "colchoes" } },
    create: {
      storeId: store.id,
      name: "Colchões",
      slug: "colchoes",
      sortOrder: 0,
      active: true,
    },
    update: { name: "Colchões", active: true, sortOrder: 0 },
  });

  const description =
    "Colchão Pikolin Mood Molas Ensacadas Firme — linha Cooper System. Altura 28 cm, espumas High Support e Cool Touch, pillow top de um lado, suporte individual até 250 kg. Frete grátis Brasil.";

  const product = await prisma.commerceProduct.upsert({
    where: { clienteId_slug: { clienteId, slug: PRODUCT_SLUG } },
    create: {
      clienteId,
      storeId: store.id,
      categoryId: category.id,
      name: "Colchão Pikolin Mood Molas Ensacadas Firme",
      slug: PRODUCT_SLUG,
      description,
      kind: "PHYSICAL",
      type: "PHYSICAL",
      status: "PUBLISHED",
      priceCents: 299900,
      maxInstallments: 10,
      coverUrl: GALLERY_MAIN,
      images: [
        { src: GALLERY_MAIN, alt: "Colchão Pikolin Mood — vista principal" },
        { src: GALLERY_TAMPO, alt: "Colchão Pikolin Mood — tampo Copper Fabric" },
        { src: TRAY_COVER, alt: "Colchão Pikolin Mood Molas Ensacadas Firme" },
      ],
      salesPage: moodSalesPage(),
      stockTracked: true,
      active: true,
      badges: { featured: true, launch: true },
    },
    update: {
      storeId: store.id,
      categoryId: category.id,
      name: "Colchão Pikolin Mood Molas Ensacadas Firme",
      description,
      kind: "PHYSICAL",
      type: "PHYSICAL",
      status: "PUBLISHED",
      priceCents: 299900,
      maxInstallments: 10,
      coverUrl: GALLERY_MAIN,
      images: [
        { src: GALLERY_MAIN, alt: "Colchão Pikolin Mood — vista principal" },
        { src: GALLERY_TAMPO, alt: "Colchão Pikolin Mood — tampo Copper Fabric" },
        { src: TRAY_COVER, alt: "Colchão Pikolin Mood Molas Ensacadas Firme" },
      ],
      salesPage: moodSalesPage(),
      stockTracked: true,
      active: true,
      badges: { featured: true, launch: true },
    },
  });

  await prisma.commerceVariant.deleteMany({ where: { productId: product.id } });
  let sort = 0;
  for (const v of VARIANTS) {
    await prisma.commerceVariant.create({
      data: {
        productId: product.id,
        sku: v.sku,
        options: { Medida: v.label },
        priceCents: v.priceCents,
        stockQty: v.stockQty,
        active: true,
        sortOrder: sort++,
      },
    });
  }

  return { store, product };
}

async function main() {
  const cliente = await upsertCliente();
  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const member = await upsertOwner(cliente.id);
  console.log("OWNER:", member.email, `(senha ${PASSWORD})`);

  await ensureContas(cliente.id);
  console.log("Contas: GOOGLE_ADS, META, GOOGLE_ANALYTICS (IDs vazios)");

  await ensureDefaultPipeline(cliente.id);
  await applyPipelinePreset(cliente.id, "ecommerce").catch(() => null);
  await applyWorkspaceEdition(cliente.id, "ecommerce");

  await prisma.workspaceSettings.upsert({
    where: { clienteId: cliente.id },
    create: {
      clienteId: cliente.id,
      primaryColor: PRIMARY,
      logoOnDarkUrl: LOGO,
      messagingPrefs: {
        attendance: {
          about: "Stresser Colchões — colchões com frete grátis e parcelamento.",
          sells: "Colchão Pikolin Mood e linha de colchões, box e acessórios.",
          conditions: "Frete grátis Brasil. Pix 15% off. Até 10x sem juros.",
          tone: "Claro, profissional e direto.",
          handoffWhen: "Cliente pediu humano ou dúvida de medida/prazo.",
          mode: "assist",
          waEnabled: true,
          hourPreset: "weekdays",
          hourStart: "09:00",
          hourEnd: "18:00",
          offerKind: "none",
        },
      } as Prisma.InputJsonValue,
    },
    update: {
      primaryColor: PRIMARY,
      logoOnDarkUrl: LOGO,
    },
  });
  console.log(`Edição: ecommerce · primary ${PRIMARY}`);

  const { store, product } = await seedStore(cliente.id);
  const variantCount = await prisma.commerceVariant.count({ where: { productId: product.id } });

  console.log(`Loja: ${store.slug} · produto ${product.slug} · ${variantCount} medidas`);
  console.log("");
  console.log("Login:   http://localhost:5000/sign-in");
  console.log(`         ${EMAIL} / ${PASSWORD}`);
  console.log("Painel:  http://localhost:5000/commerce");
  console.log("CRM:     http://localhost:5000/crm");
  console.log(`LP:      http://localhost:5000/p/${PRODUCT_SLUG}`);
  console.log("Host:    https://lp.stressercolchoes.com.br/  (após DNS + Traefik)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
