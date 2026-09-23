"use client";

import { Render } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { createLpPuckConfig } from "@/lib/criar/puck/config";
import {
  LpPuckProvider,
  type LpCheckoutBump,
  type LpFormCatalogItem,
  type LpPuckProduct,
} from "@/lib/criar/puck/context";
import type { LpSalesPageV2 } from "@/lib/criar/lp-schema";

type Props = {
  page: LpSalesPageV2;
  product: LpPuckProduct;
  brandName: string;
  currency?: string;
  mpPublicKey?: string | null;
  formSlug?: string | null;
  formCatalog?: LpFormCatalogItem[];
  checkoutProduct?: LpPuckProduct | null;
  bump?: LpCheckoutBump | null;
  checkoutCatalog?: LpPuckProduct[];
  bumpByProductId?: Record<string, LpCheckoutBump | null>;
};

/** Render público da LP v2 (Puck). */
export function SalesPagePuckView({
  page,
  product,
  brandName,
  currency = "BRL",
  mpPublicKey = null,
  formSlug,
  formCatalog = [],
  checkoutProduct = null,
  bump = null,
  checkoutCatalog = [],
  bumpByProductId = {},
}: Props) {
  const config = createLpPuckConfig();

  return (
    <LpPuckProvider
      value={{
        goal: page.goal,
        preview: false,
        product,
        brandName,
        currency,
        mpPublicKey,
        formSlug,
        formCatalog,
        checkoutProduct,
        bump,
        checkoutCatalog,
        bumpByProductId,
      }}
    >
      <div className="lp-page">
        <Render config={config} data={page.puck} />
        {page.deliverable && page.goal === "sales" ? (
          <p className="lp-block text-center type-fine-print text-[var(--ink-muted-48)]">
            Após o pagamento: {page.deliverable.label}
          </p>
        ) : null}
      </div>
    </LpPuckProvider>
  );
}
