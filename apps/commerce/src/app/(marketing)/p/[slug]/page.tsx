import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { AirFryerLanding } from "@/components/marketing/lp/AirFryerLanding";
import { PlantasLanding } from "@/components/marketing/lp/PlantasLanding";
import { BolosLanding } from "@/components/marketing/lp/BolosLanding";
import { prisma } from "@/lib/prisma";
import { getOrCreatePaymentSettings } from "@/lib/mercadopago/client";
import { resolvePixelForProduct } from "@/lib/meta";

type Props = { params: Promise<{ slug: string }> };

const LP_META: Record<
  string,
  { title: string; description: string; image: string }
> = {
  "air-fryer-50-receitas": {
    title: "Simples e Saudáveis: 50 Receitas na Air Fryer",
    description:
      "Pare de improvisar o jantar. 50 receitas leves e gostosas para Air Fryer, por menos que um delivery. Acesso na hora.",
    image: "/produtos/capa-airfryer.png",
  },
  "plantas-medicinais": {
    title: "Tratado das Plantas Medicinais Mineiras, Nativas e Cultivadas",
    description:
      "Conheça plantas medicinais, formas de preparo, partes utilizadas, aplicações, toxicidade e contraindicações em um único e-book. R$ 29,90.",
    image: "/produtos/capa-plantas.png",
  },
  "100-melhores-bolos": {
    title: "Os 100 Melhores Bolos",
    description:
      "100 bolos deliciosos, fáceis e testados para fazer em casa. E-book digital por R$ 19,90. Acesso na hora.",
    image: "/produtos/capa-bolos.png",
  },
};

const LP_SLUGS = new Set(Object.keys(LP_META));

async function getProduct(slug: string) {
  return prisma.product.findFirst({
    where: { slug, status: "PUBLISHED" },
  });
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) return { title: "Produto não encontrado" };

  const meta = LP_META[slug];
  if (!meta) {
    return {
      title: { absolute: product.name },
      description: product.description ?? undefined,
    };
  }

  return {
    title: { absolute: meta.title },
    description: meta.description,
    openGraph: {
      title: meta.title,
      description: meta.description,
      images: [{ url: meta.image }],
    },
  };
}

export default async function SalesPage({ params }: Props) {
  const { slug } = await params;
  const product = await getProduct(slug);
  if (!product) notFound();

  if (!LP_SLUGS.has(slug)) {
    notFound();
  }

  const [bump, paymentSettings, pixel] = await Promise.all([
    prisma.offer.findFirst({
      where: {
        triggerProductId: product.id,
        type: "ORDER_BUMP",
        active: true,
      },
      include: { offeredProduct: true },
      orderBy: { position: "asc" },
    }),
    getOrCreatePaymentSettings(),
    resolvePixelForProduct(product.id),
  ]);

  const shared = {
    product: {
      id: product.id,
      name: product.name,
      priceCents: product.priceCents,
      maxInstallments: product.maxInstallments,
      description: product.description,
    },
    bump,
    paymentSettings: {
      cardEnabled: paymentSettings.cardEnabled,
      pixEnabled: paymentSettings.pixEnabled,
      maxInstallments: paymentSettings.maxInstallments,
      minInstallments: paymentSettings.minInstallments,
    },
    pixelId: pixel.pixelId,
  };

  if (slug === "plantas-medicinais") {
    return <PlantasLanding {...shared} />;
  }

  if (slug === "100-melhores-bolos") {
    return <BolosLanding {...shared} />;
  }

  return <AirFryerLanding {...shared} />;
}
