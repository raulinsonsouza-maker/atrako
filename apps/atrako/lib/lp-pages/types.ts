import type { LpGoal } from "@/lib/criar/lp-schema";
import type { LpV3Theme } from "@/lib/criar/lp-v3";

export type LpPageGalleryItem = {
  src: string;
  alt: string;
  kind?: "image" | "video";
  poster?: string;
};

export type LpPageLayer = {
  id: number;
  title: string;
  body?: string;
  imageUrl: string;
};

/** meta.json de `lp-pages/{slug}/` */
export type LpPageMeta = {
  productSlug: string;
  workspaceSlug?: string;
  goal: LpGoal;
  fonts?: string[];
  theme?: LpV3Theme;
  brief?: string;
  pixDiscountPercent?: number;
  /** URLs de vídeo permitidas pelo sanitize (paths `/…` ou https). */
  videoUrls?: string[];
  gallery?: LpPageGalleryItem[];
  layers?: LpPageLayer[];
  layersTitle?: string;
  layersHint?: string;
  checkoutProductId?: string | null;
  formId?: string | null;
};

export type LpPagePackage = {
  slug: string;
  dir: string;
  meta: LpPageMeta;
  html: string;
  css: string;
  /** Arquivos em assets/ (nome flat no destino). */
  assetFiles: Array<{ absPath: string; destName: string }>;
};
