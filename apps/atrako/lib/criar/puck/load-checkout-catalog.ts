import { prisma } from "@/lib/db";
import type {
  LpCheckoutBump,
  LpFormCatalogItem,
  LpPuckProduct,
} from "@/lib/criar/puck/context";
import {
  checkoutProductIdsFromPuck,
  formIdsFromPuck,
} from "@/lib/criar/puck/puck-checkout";
import type { LpSalesPageV2 } from "@/lib/criar/lp-schema";

export async function loadCheckoutCatalogForPage(opts: {
  clienteId: string;
  page: LpSalesPageV2;
  linkedCheckoutId: string | null;
  fallbackProduct: LpPuckProduct;
}): Promise<{
  checkoutProduct: LpPuckProduct | null;
  checkoutCatalog: LpPuckProduct[];
  bumpByProductId: Record<string, LpCheckoutBump | null>;
  formCatalog: LpFormCatalogItem[];
}> {
  const ids = new Set<string>();
  for (const id of checkoutProductIdsFromPuck(opts.page.puck)) ids.add(id);
  if (opts.linkedCheckoutId) ids.add(opts.linkedCheckoutId);

  const products = ids.size
    ? await prisma.commerceProduct.findMany({
        where: {
          clienteId: opts.clienteId,
          id: { in: [...ids] },
          active: true,
          status: "PUBLISHED",
          priceCents: { gt: 0 },
        },
      })
    : [];

  const checkoutCatalog: LpPuckProduct[] = products.map((cp) => ({
    id: cp.id,
    name: cp.name,
    slug: cp.slug,
    priceCents: cp.priceCents,
    description: cp.description,
    clienteId: cp.clienteId,
    type: cp.type,
  }));

  let checkoutProduct: LpPuckProduct | null = null;
  if (opts.linkedCheckoutId) {
    checkoutProduct =
      checkoutCatalog.find((p) => p.id === opts.linkedCheckoutId) ?? null;
  }
  if (
    !checkoutProduct &&
    opts.page.goal === "sales" &&
    opts.fallbackProduct.priceCents > 0
  ) {
    checkoutProduct = opts.fallbackProduct;
    if (!checkoutCatalog.some((p) => p.id === checkoutProduct!.id)) {
      checkoutCatalog.push(checkoutProduct);
    }
  }

  const bumpByProductId: Record<string, LpCheckoutBump | null> = {};
  for (const p of checkoutCatalog) {
    const bumpOffer = await prisma.commerceOffer.findFirst({
      where: {
        clienteId: opts.clienteId,
        triggerProductId: p.id,
        type: "ORDER_BUMP",
        active: true,
      },
      include: { offeredProduct: true },
      orderBy: { position: "asc" },
    });
    bumpByProductId[p.id] = bumpOffer
      ? {
          id: bumpOffer.offeredProduct.id,
          name: bumpOffer.offeredProduct.name,
          priceCents: bumpOffer.offeredProduct.priceCents,
          discountPercent: bumpOffer.discountPercent,
          headline: bumpOffer.headline,
        }
      : null;
  }

  const formIdSet = new Set<string>(formIdsFromPuck(opts.page.puck));
  if (typeof opts.page.formId === "string" && opts.page.formId.trim()) {
    formIdSet.add(opts.page.formId.trim());
  }

  const forms = formIdSet.size
    ? await prisma.captureForm.findMany({
        where: {
          clienteId: opts.clienteId,
          id: { in: [...formIdSet] },
          active: true,
          status: "PUBLISHED",
        },
        select: { id: true, name: true, slug: true },
      })
    : [];

  const formCatalog: LpFormCatalogItem[] = forms.map((f) => ({
    id: f.id,
    name: f.name,
    slug: f.slug,
  }));

  return {
    checkoutProduct,
    checkoutCatalog,
    bumpByProductId,
    formCatalog,
  };
}
