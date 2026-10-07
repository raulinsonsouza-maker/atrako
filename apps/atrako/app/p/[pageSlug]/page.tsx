import { prisma } from "@/lib/db";
import { getWorkspaceConfig, resolveBrand, resolveTracking } from "@/lib/config/getWorkspaceConfig";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { SubNavFrosted } from "@/components/ui/sub-nav-frosted";
import { SiteFooter } from "@/components/ui/site-footer";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { PublicUnavailable } from "@/components/modules/PublicUnavailable";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { SalesPageView } from "@/components/commerce/SalesPageView";
import { SalesPagePuckView } from "@/components/commerce/SalesPagePuckView";
import {
  isLpSalesPageV2,
  normalizeSalesPage,
} from "@/lib/criar/lp-schema";
import { getCaptureFormById } from "@/lib/modules/capture-form";
import type {
  LpCheckoutBump,
  LpFormCatalogItem,
  LpPuckProduct,
} from "@/lib/criar/puck/context";
import { loadCheckoutCatalogForPage } from "@/lib/criar/puck/load-checkout-catalog";
import { isLpSalesPageV3 } from "@/lib/criar/lp-v3";
import { verifyPreviewToken } from "@/lib/criar/preview-token";
import { flattenFields } from "@/lib/criar/form-test";
import { SalesPageHtmlView } from "@/components/commerce/SalesPageHtmlView";

type Props = {
  params: Promise<{ pageSlug: string }>;
  searchParams: Promise<{ embed?: string; preview?: string }>;
};

/** Publicada pelo slug; com token de prévia válido, abre o rascunho pelo id. */
async function loadProduct(pageSlug: string, previewToken?: string) {
  const preview = verifyPreviewToken(previewToken, "lp");
  if (preview) {
    const draft = await prisma.commerceProduct.findFirst({
      where: { id: preview.id, clienteId: preview.ws, active: true },
    });
    if (draft) return { product: draft, preview: true };
  }
  const product = await prisma.commerceProduct.findFirst({
    where: { slug: pageSlug, active: true, status: "PUBLISHED" },
  });
  return product ? { product, preview: false } : null;
}

function firstHeading(html: string): string | null {
  const m = html.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/i);
  const text = m?.[1]?.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
  return text ? text.slice(0, 120) : null;
}

export async function generateMetadata({ params, searchParams }: Props): Promise<Metadata> {
  const { pageSlug } = await params;
  const sp = await searchParams;
  const loaded = await loadProduct(pageSlug, sp.preview);
  if (!loaded) return { title: "Oferta" };
  const { product } = loaded;
  if (loaded.preview) return { title: `Prévia — ${product.name}`, robots: { index: false, follow: false } };

  if (isLpSalesPageV3(product.salesPage)) {
    return {
      title: firstHeading(product.salesPage.html) ?? product.name,
      description: product.description ?? undefined,
    };
  }

  if (isLpSalesPageV2(product.salesPage)) {
    const hero = product.salesPage.puck.content?.find(
      (c) => c.type === "Hero" || c.type === "Heading",
    );
    const title =
      hero && typeof hero.props?.title === "string"
        ? hero.props.title
        : hero && typeof hero.props?.text === "string"
          ? hero.props.text
          : product.name;
    return { title };
  }

  const page = normalizeSalesPage(product.salesPage);
  const hero = page.sections.find((s) => s.type === "hero");
  const headline =
    hero && hero.type === "hero" ? hero.headline : product.name;
  const sub =
    hero && hero.type === "hero" ? hero.subheadline : product.description;
  return {
    title: headline,
    description: sub ?? undefined,
  };
}

/** LP pública — v2 Puck ou v1 seções. */
export default async function PublicLpPage({ params, searchParams }: Props) {
  const { pageSlug } = await params;
  const sp = await searchParams;
  const embed = sp.embed === "1";
  const loaded = await loadProduct(pageSlug, sp.preview);
  if (!loaded) notFound();
  const { product } = loaded;
  const previewToken = loaded.preview ? sp.preview ?? null : null;

  const [config, mpPublicKey] = await Promise.all([
    getWorkspaceConfig(product.clienteId),
    getMpPublicKey(product.clienteId),
  ]);
  const brand = config ? resolveBrand(config) : null;
  const tracking = (config ? resolveTracking(config) : {}) as { pixelId?: string };
  const brandName = brand?.name || "Atrako";
  const productPayload: LpPuckProduct = {
    id: product.id,
    name: product.name,
    slug: product.slug,
    priceCents: product.priceCents,
    description: product.description,
    clienteId: product.clienteId,
    type: product.type,
  };

  const salesRaw = product.salesPage;
  if (isLpSalesPageV3(salesRaw)) {
    if (salesRaw.goal !== "leads" && !(await isPublicModuleEnabled(product.clienteId, "commerce"))) {
      return <PublicUnavailable brandName={brandName} />;
    }
    const form = salesRaw.formId ? await getCaptureFormById(product.clienteId, salesRaw.formId) : null;
    const formReady = Boolean(form?.active && (previewToken || form.status === "PUBLISHED"));
    const checkoutRow = salesRaw.checkoutProductId
      ? await prisma.commerceProduct.findFirst({
          where: {
            id: salesRaw.checkoutProductId,
            clienteId: product.clienteId,
            active: true,
            priceCents: { gt: 0 },
            ...(previewToken ? {} : { status: "PUBLISHED" as const }),
          },
        })
      : null;
    const checkoutV3: LpPuckProduct | null = checkoutRow
      ? {
          id: checkoutRow.id,
          name: checkoutRow.name,
          slug: checkoutRow.slug,
          priceCents: checkoutRow.priceCents,
          description: checkoutRow.description,
          clienteId: checkoutRow.clienteId,
          type: checkoutRow.type,
        }
      : null;
    return (
      <BrandThemeScope primaryColor={brand?.primaryColor} className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]">
        {typeof tracking.pixelId === "string" && tracking.pixelId && !embed && !previewToken ? (
          <script
            dangerouslySetInnerHTML={{
              __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.pixelId}');fbq('track','PageView');`,
            }}
          />
        ) : null}
        <SalesPageHtmlView
          page={salesRaw}
          product={productPayload}
          brandName={brandName}
          currency={brand?.currency || "BRL"}
          mpPublicKey={mpPublicKey}
          form={
            formReady && form
              ? { slug: form.status === "PUBLISHED" ? form.slug : null, name: form.name, fields: flattenFields(form.steps) }
              : null
          }
          checkoutProduct={checkoutV3}
          previewToken={previewToken}
        />
      </BrandThemeScope>
    );
  }

  const isV2 = isLpSalesPageV2(salesRaw);
  const pageV2 = isV2 ? salesRaw : null;
  const pageV1 = isV2 ? null : normalizeSalesPage(salesRaw);
  const goal = pageV2?.goal ?? pageV1!.goal;
  if (goal !== "leads" && !(await isPublicModuleEnabled(product.clienteId, "commerce"))) {
    return <PublicUnavailable brandName={brandName} />;
  }
  const ctaHref = goal === "leads" ? "#form" : "#checkout";
  const ctaLabel = goal === "leads" ? "Quero receber" : "Comprar";

  const linkedFormId = pageV2?.formId || pageV1?.formId;
  let formSlug: string | null = null;
  if (linkedFormId) {
    const form = await getCaptureFormById(product.clienteId, linkedFormId);
    if (form?.active && form.status === "PUBLISHED") {
      formSlug = form.slug;
    }
  }

  const linkedCheckoutId =
    pageV2?.checkoutProductId || pageV1?.checkoutProductId || null;

  let checkoutProduct: LpPuckProduct | null = null;
  let checkoutCatalog: LpPuckProduct[] = [];
  let bumpByProductId: Record<string, LpCheckoutBump | null> = {};
  let bump: LpCheckoutBump | null = null;
  let formCatalog: LpFormCatalogItem[] = [];

  if (pageV2) {
    const loaded = await loadCheckoutCatalogForPage({
      clienteId: product.clienteId,
      page: pageV2,
      linkedCheckoutId,
      fallbackProduct: productPayload,
    });
    checkoutProduct = loaded.checkoutProduct;
    checkoutCatalog = loaded.checkoutCatalog;
    bumpByProductId = loaded.bumpByProductId;
    formCatalog = loaded.formCatalog;
    bump = checkoutProduct
      ? bumpByProductId[checkoutProduct.id] ?? null
      : null;
  } else if (linkedCheckoutId) {
    const cp = await prisma.commerceProduct.findFirst({
      where: {
        id: linkedCheckoutId,
        clienteId: product.clienteId,
        active: true,
        status: "PUBLISHED",
        priceCents: { gt: 0 },
      },
    });
    if (cp) {
      checkoutProduct = {
        id: cp.id,
        name: cp.name,
        slug: cp.slug,
        priceCents: cp.priceCents,
        description: cp.description,
        clienteId: cp.clienteId,
        type: cp.type,
      };
    }
  } else if (goal === "sales" && product.priceCents > 0) {
    checkoutProduct = productPayload;
  }

  const footerCheckoutHref = checkoutProduct
    ? `/checkout/${checkoutProduct.id}`
    : `/checkout/${product.id}`;

  return (
    <BrandThemeScope
      primaryColor={brand?.primaryColor}
      className="min-h-screen bg-[var(--canvas)] text-[var(--ink)]"
    >
      {typeof tracking.pixelId === "string" && tracking.pixelId && !embed ? (
        <script
          dangerouslySetInnerHTML={{
            __html: `!function(f,b,e,v,n,t,s){if(f.fbq)return;n=f.fbq=function(){n.callMethod?n.callMethod.apply(n,arguments):n.queue.push(arguments)};if(!f._fbq)f._fbq=n;n.push=n;n.loaded=!0;n.version='2.0';n.queue=[];t=b.createElement(e);t.async=!0;t.src=v;s=b.getElementsByTagName(e)[0];s.parentNode.insertBefore(t,s)}(window,document,'script','https://connect.facebook.net/en_US/fbevents.js');fbq('init','${tracking.pixelId}');fbq('track','PageView');`,
          }}
        />
      ) : null}

      {!embed ? (
        <SubNavFrosted
          title={brandName}
          links={[{ href: `/p/${product.slug}`, label: "Oferta" }]}
          ctaHref={ctaHref}
          ctaLabel={ctaLabel}
        />
      ) : null}

      <div className="w-full">
        {brand?.logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={brand.logoUrl}
            alt={brandName}
            className="mx-auto mb-2 mt-6 h-10 object-contain"
          />
        ) : null}

        {pageV2 ? (
          <SalesPagePuckView
            page={pageV2}
            product={productPayload}
            brandName={brandName}
            currency={brand?.currency || "BRL"}
            mpPublicKey={mpPublicKey}
            formSlug={formSlug}
            formCatalog={formCatalog}
            checkoutProduct={checkoutProduct}
            bump={bump}
            checkoutCatalog={checkoutCatalog}
            bumpByProductId={bumpByProductId}
          />
        ) : (
          <div className="mx-auto max-w-2xl px-4 py-10 sm:py-14">
            <SalesPageView
              page={pageV1!}
              product={productPayload}
              brandName={brandName}
              currency={brand?.currency || "BRL"}
              mpPublicKey={mpPublicKey}
              formSlug={formSlug}
              checkoutProduct={checkoutProduct}
              bump={bump}
            />
          </div>
        )}
      </div>

      {!embed ? (
        <SiteFooter
          columns={[
            {
              title: brandName,
              links: [
                { href: `/p/${product.slug}`, label: "Oferta" },
                ...(goal === "sales"
                  ? [{ href: footerCheckoutHref, label: "Checkout" }]
                  : [{ href: `#form`, label: "Formulário" }]),
              ],
            },
          ]}
        />
      ) : null}
    </BrandThemeScope>
  );
}
