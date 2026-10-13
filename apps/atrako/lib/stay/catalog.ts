/**
 * Imóvel inicial da edição Aluguel por temporada.
 * O primeiro conteúdo é a landing do Refúgio (archive/apps/Imobiliário).
 */

import { prisma } from "@/lib/db";

export const REFUGIO_FRAMES = 96;

export const REFUGIO_FEATURES = [
  { title: "Integração natural", text: "Implantação cuidadosa e materiais que pertencem à paisagem." },
  { title: "Luz como matéria", text: "Aberturas generosas acompanham o movimento do dia." },
  { title: "Vista preservada", text: "Cada ambiente enquadra a floresta como uma obra viva." },
  { title: "Liberdade essencial", text: "Conforto, privacidade e espaço para viver no seu ritmo." },
];

export const REFUGIO_HIGHLIGHTS = [
  { value: "08", label: "segundos de imersão" },
  { value: "360°", label: "de natureza" },
  { value: "01", label: "refúgio singular" },
];

const REFUGIO_PHOTOS = [
  { src: "/stay/images/cabana-noite.png", alt: "Cabana A-frame iluminada em meio à floresta" },
  { src: "/stay/images/cabana-dia.png", alt: "Cabana A-frame entre árvores durante o dia" },
];

function propertySlug(clienteSlug: string) {
  return clienteSlug.trim().toLowerCase().replace(/[^a-z0-9-]/g, "").slice(0, 60) || "refugio";
}

async function uniqueSlug(base: string) {
  let slug = base;
  for (let i = 0; i < 6; i++) {
    const hit = await prisma.stayProperty.findUnique({ where: { slug }, select: { id: true } });
    if (!hit) return slug;
    slug = `${base}-${i + 2}`.slice(0, 80);
  }
  return `${base}-${Date.now().toString(36)}`.slice(0, 80);
}

/** Cria o imóvel se o workspace ainda não tem. Idempotente. */
export async function ensureStayProperty(clienteId: string) {
  const existing = await prisma.stayProperty.findUnique({ where: { clienteId } });
  if (existing) return existing;
  const cliente = await prisma.cliente.findUnique({ where: { id: clienteId }, select: { slug: true, nome: true } });
  const slug = await uniqueSlug(propertySlug(cliente?.slug || "refugio"));
  return prisma.stayProperty.create({
    data: {
      clienteId,
      slug,
      name: "Refúgio Atrako",
      headline: "Uma casa que pede menos pressa e devolve mais presença.",
      concept: "Viver bem é voltar ao essencial.",
      story:
        "O Refúgio Atrako nasce da união entre desenho preciso e paisagem intocada. Um lugar criado para finais de semana longos, manhãs sem agenda e noites iluminadas apenas pelo fogo e pelas estrelas.",
      photos: REFUGIO_PHOTOS,
      features: REFUGIO_FEATURES,
      highlights: REFUGIO_HIGHLIGHTS,
      nightlyCents: 89000,
      cleaningFeeCents: 15000,
      minNights: 2,
      maxNights: 14,
      checkInTime: "15:00",
      checkOutTime: "11:00",
      heroFrameCount: REFUGIO_FRAMES,
    },
  });
}

export async function ensureStayWorkspace(clienteId: string) {
  return ensureStayProperty(clienteId);
}

export type StayPhoto = { src: string; alt: string };
export type StayFeature = { title: string; text: string };
export type StayHighlight = { value: string; label: string };

function rows(raw: unknown): Record<string, unknown>[] {
  if (!Array.isArray(raw)) return [];
  return raw.filter((item): item is Record<string, unknown> => Boolean(item) && typeof item === "object");
}

export function asPhotos(raw: unknown): StayPhoto[] {
  return rows(raw).flatMap((item) => {
    const src = typeof item.src === "string" ? item.src : "";
    const alt = typeof item.alt === "string" ? item.alt : "";
    return src ? [{ src, alt }] : [];
  });
}

export function asFeatures(raw: unknown): StayFeature[] {
  return rows(raw).flatMap((item) => {
    const title = typeof item.title === "string" ? item.title : "";
    const text = typeof item.text === "string" ? item.text : "";
    return title ? [{ title, text }] : [];
  });
}

export function asHighlights(raw: unknown): StayHighlight[] {
  return rows(raw).flatMap((item) => {
    const value = typeof item.value === "string" ? item.value : "";
    const label = typeof item.label === "string" ? item.label : "";
    return value ? [{ value, label }] : [];
  });
}

export function publicProperty(property: {
  slug: string;
  name: string;
  headline: string | null;
  story: string | null;
  concept: string | null;
  photos: unknown;
  features: unknown;
  highlights: unknown;
  nightlyCents: number;
  cleaningFeeCents: number;
  minNights: number;
  maxNights: number;
  checkInTime: string;
  checkOutTime: string;
  acceptingBookings: boolean;
  heroFrameCount: number;
  timezone: string;
}) {
  return {
    slug: property.slug,
    name: property.name,
    headline: property.headline,
    story: property.story,
    concept: property.concept,
    photos: asPhotos(property.photos),
    features: asFeatures(property.features),
    highlights: asHighlights(property.highlights),
    nightlyCents: property.nightlyCents,
    cleaningFeeCents: property.cleaningFeeCents,
    minNights: property.minNights,
    maxNights: property.maxNights,
    checkInTime: property.checkInTime,
    checkOutTime: property.checkOutTime,
    acceptingBookings: property.acceptingBookings,
    heroFrameCount: property.heroFrameCount,
    timezone: property.timezone,
  };
}
