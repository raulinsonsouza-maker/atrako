"use client";

import { createContext, useContext } from "react";
import type { LpGoal } from "@/lib/criar/lp-schema";

export type LpPuckProduct = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  description: string | null;
  clienteId: string;
  type?: string;
};

export type LpFormCatalogItem = {
  id: string;
  name: string;
  slug: string;
};

export type LpCheckoutBump = {
  id: string;
  name: string;
  priceCents: number;
  discountPercent: number;
  headline: string | null;
};

export type LpPuckRenderCtx = {
  goal: LpGoal;
  preview: boolean;
  /** Produto da página (LP). */
  product: LpPuckProduct;
  brandName: string;
  currency: string;
  mpPublicKey: string | null;
  /**
   * Form legado da página (`salesPage.formId` → slug).
   * Blocos novos preferem `formId` próprio + `formCatalog`.
   */
  formSlug?: string | null;
  /** CaptureForms publicados para o seletor do bloco. */
  formCatalog?: LpFormCatalogItem[];
  /** Após criar checkout no bloco — atualiza o catálogo no studio. */
  onCheckoutCreated?: (product: LpPuckProduct) => void;
  /** Após criar form no bloco — atualiza o catálogo no studio. */
  onFormCreated?: (form: LpFormCatalogItem) => void;
  /** Produto vendido pelo bloco AtrakoCheckout (legado: default da página). */
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  /** Checkouts publicados para campo productId nos blocos Checkout. */
  checkoutCatalog?: LpPuckProduct[];
  /** Bump por produto checkout (página pública). */
  bumpByProductId?: Record<string, LpCheckoutBump | null>;
};

const defaultCtx: LpPuckRenderCtx = {
  goal: "leads",
  preview: true,
  product: {
    id: "preview",
    name: "Oferta",
    slug: "preview",
    priceCents: 0,
    description: null,
    clienteId: "",
  },
  brandName: "Sua marca",
  currency: "BRL",
  mpPublicKey: null,
};

const Ctx = createContext<LpPuckRenderCtx>(defaultCtx);

export function LpPuckProvider({
  value,
  children,
}: {
  value: LpPuckRenderCtx;
  children: React.ReactNode;
}) {
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useLpPuckCtx() {
  return useContext(Ctx);
}
