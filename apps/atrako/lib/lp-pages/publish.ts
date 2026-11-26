import fs from "fs/promises";
import path from "path";
import { prisma } from "@/lib/db";
import { buildSalesPageV3 } from "@/lib/criar/lp-html";
import { saveUpload, uploadsDir } from "@/lib/uploads";
import { loadLpPagePackage, rewriteAssetUrls } from "./load-package";
import type { LpPageMeta, LpPagePackage } from "./types";
import type { LpSalesPageV3 } from "@/lib/criar/lp-v3";
import { Prisma } from "@/lib/generated/prisma";

export type PublishLpResult = {
  productId: string;
  productSlug: string;
  packageSlug: string;
  assetsCopied: string[];
  htmlBytes: number;
  cssBytes: number;
  salesPage: LpSalesPageV3;
};

async function copyAssetsToLpMedia(pkg: LpPagePackage): Promise<string[]> {
  const copied: string[] = [];
  for (const file of pkg.assetFiles) {
    const buf = await fs.readFile(file.absPath);
    await saveUpload("lp-media", file.destName, buf);
    copied.push(`/lp-media/${file.destName}`);
  }
  // Garante pasta mesmo sem assets (ops)
  await fs.mkdir(uploadsDir("lp-media"), { recursive: true }).catch(() => null);
  return copied;
}

function attachWidgets(page: LpSalesPageV3, meta: LpPageMeta): LpSalesPageV3 {
  const next: LpSalesPageV3 = { ...page };
  if (typeof meta.pixDiscountPercent === "number") {
    next.pixDiscountPercent = Math.min(100, Math.max(0, Math.round(meta.pixDiscountPercent)));
  }
  if (meta.gallery?.length) next.gallery = meta.gallery;
  if (meta.layers?.length) next.layers = meta.layers;
  if (meta.layersTitle) next.layersTitle = meta.layersTitle;
  if (meta.layersHint) next.layersHint = meta.layersHint;
  if (meta.checkout && typeof meta.checkout === "object") next.checkout = meta.checkout;
  return next;
}

/** Rewrite gallery/layers URLs that still point at package-relative assets. */
function rewriteWidgetUrls(meta: LpPageMeta, pkg: LpPagePackage): LpPageMeta {
  const map = new Map<string, string>();
  for (const file of pkg.assetFiles) {
    const originalRel = file.absPath
      .slice(path.join(pkg.dir, "assets").length)
      .replace(/\\/g, "/")
      .replace(/^\//, "");
    map.set(`assets/${originalRel}`, `/lp-media/${file.destName}`);
    map.set(`./assets/${originalRel}`, `/lp-media/${file.destName}`);
  }
  const swap = (url: string) => map.get(url) ?? url;
  return {
    ...meta,
    gallery: meta.gallery?.map((g) => ({
      ...g,
      src: swap(g.src),
      poster: g.poster ? swap(g.poster) : g.poster,
    })),
    layers: meta.layers?.map((l) => ({ ...l, imageUrl: swap(l.imageUrl) })),
    videoUrls: meta.videoUrls?.map(swap),
  };
}

/**
 * Publica pacote `lp-pages/{slug}` no CommerceProduct.salesPage (v3) + assets em lp-media.
 * Não requer rebuild do atrako-web.
 */
export async function publishLpPackage(
  packageSlug: string,
  opts?: { cwd?: string; skipAssets?: boolean },
): Promise<PublishLpResult> {
  const cwd = opts?.cwd ?? process.cwd();
  const pkg = loadLpPagePackage(packageSlug, cwd);
  const assetsCopied = opts?.skipAssets ? [] : await copyAssetsToLpMedia(pkg);
  const rewritten = rewriteAssetUrls(pkg, pkg.html, pkg.css);
  const meta = rewriteWidgetUrls(pkg.meta, pkg);

  const built = buildSalesPageV3({
    goal: meta.goal,
    html: rewritten.html,
    css: rewritten.css,
    fonts: meta.fonts,
    theme: meta.theme,
    brief: meta.brief || `LP Pages: ${packageSlug}`,
    generatedBy: "lp-pages-publish",
    formId: meta.formId,
    checkoutProductId: meta.checkoutProductId,
    videoUrls: meta.videoUrls ?? [],
  });

  const salesPage = attachWidgets(built, meta);

  const product = await prisma.commerceProduct.findFirst({
    where: { slug: meta.productSlug, active: true },
    select: { id: true, slug: true, salesPage: true },
  });
  if (!product) {
    throw new Error(`Produto não encontrado: ${meta.productSlug}`);
  }

  // Preserva previous a partir do HTML atual se já era v3
  const prev = product.salesPage as LpSalesPageV3 | null;
  if (prev && prev.version === 3 && prev.html) {
    salesPage.previous = {
      html: prev.html,
      css: prev.css,
      cssSource: prev.cssSource,
      updatedAt: prev.updatedAt,
    };
  }

  await prisma.commerceProduct.update({
    where: { id: product.id },
    data: {
      salesPage: salesPage as unknown as Prisma.InputJsonValue,
      status: "PUBLISHED",
    },
  });

  return {
    productId: product.id,
    productSlug: product.slug,
    packageSlug,
    assetsCopied,
    htmlBytes: Buffer.byteLength(salesPage.html, "utf8"),
    cssBytes: Buffer.byteLength(salesPage.css, "utf8"),
    salesPage,
  };
}
