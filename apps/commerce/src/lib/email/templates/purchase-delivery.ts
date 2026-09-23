import { brandFromProduct } from "@/lib/email/brands";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml, renderEmailLayout } from "@/lib/email/templates/layout";
import { absoluteUrl } from "@/lib/utils";

export async function sendPurchaseDeliveryEmail(input: {
  to: string;
  name: string;
  orderId: string;
  product: {
    name: string;
    slug?: string | null;
    fileId?: string | null;
  };
}) {
  const brand = brandFromProduct({
    slug: input.product.slug,
    name: input.product.name,
  });

  const firstName = input.name.trim().split(/\s+/)[0] || "olá";
  const downloadHref = input.product.fileId
    ? absoluteUrl(
        `/api/orders/download?orderId=${encodeURIComponent(input.orderId)}&fileId=${encodeURIComponent(input.product.fileId)}`,
      )
    : absoluteUrl("/membros");
  const membersHref = absoluteUrl("/membros");

  const html = renderEmailLayout({
    brand,
    preheader: `${brand.productLabel} liberado — baixe agora.`,
    title: "Seu e-book está pronto",
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${brand.ink}">
        Olá, <strong>${escapeHtml(firstName)}</strong>!
      </p>
      <p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${brand.ink}">
        Seu e-book <strong>${escapeHtml(brand.productLabel)}</strong> está pronto.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:${brand.muted}">
        ${escapeHtml(brand.hook)}
      </p>
    `,
    ctaLabel: brand.ctaDelivery,
    ctaHref: downloadHref,
    secondaryHtml: `Prefere acessar depois? <a href="${membersHref}" style="color:${brand.accentDeep};text-decoration:underline">Entrar na área de membros</a>`,
  });

  return sendEmail({
    to: input.to,
    subject: `${brand.productLabel} — baixe agora`,
    html,
    tags: [
      { name: "type", value: "purchase_delivery" },
      { name: "product", value: brand.slug },
    ],
  });
}
