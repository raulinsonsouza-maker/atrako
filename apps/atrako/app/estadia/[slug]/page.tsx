import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { StayPublic } from "@/components/stay/StayPublic";

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const property = await prisma.stayProperty.findUnique({
    where: { slug },
    select: { name: true, headline: true, published: true },
  });
  if (!property?.published) return { title: "Imóvel" };
  return { title: property.name, description: property.headline ?? undefined };
}

export default async function StayPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  return <StayPublic slug={slug} />;
}
