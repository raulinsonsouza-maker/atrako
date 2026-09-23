import { brandFromProduct } from "@/lib/email/brands";
import { sendEmail } from "@/lib/email/resend";
import { escapeHtml, renderEmailLayout } from "@/lib/email/templates/layout";
import { absoluteUrl, formatBRL } from "@/lib/utils";

export async function sendAbandonedCartEmail(input: {
  to: string;
  name: string;
  orderId: string;
  amountCents: number;
  hasPix: boolean;
  product: {
    name: string;
    slug?: string | null;
  };
}) {
  const brand = brandFromProduct({
    slug: input.product.slug,
    name: input.product.name,
  });

  const firstName = input.name.trim().split(/\s+/)[0] || "olá";
  const price = formatBRL(input.amountCents);
  const ctaHref = input.hasPix
    ? absoluteUrl(`/checkout/pix/${encodeURIComponent(input.orderId)}`)
    : absoluteUrl(input.product.slug ? `/p/${input.product.slug}#checkout` : "/");

  const html = renderEmailLayout({
    brand,
    preheader: `Seu pedido de ${price} ainda está aberto.`,
    title: "Seu pedido está esperando",
    bodyHtml: `
      <p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${brand.ink}">
        Olá, <strong>${escapeHtml(firstName)}</strong>!
      </p>
      <p style="margin:0 0 14px;font-size:16px;line-height:1.55;color:${brand.ink}">
        Seu pedido de <strong>${escapeHtml(brand.productLabel)}</strong> (${escapeHtml(price)}) ainda está aberto.
      </p>
      <p style="margin:0;font-size:15px;line-height:1.55;color:${brand.muted}">
        ${escapeHtml(brand.abandonHook)}
        ${input.hasPix ? " Seu PIX ainda está disponível." : ""}
      </p>
    `,
    ctaLabel: brand.ctaAbandon,
    ctaHref,
  });

  return sendEmail({
    to: input.to,
    subject: `${brand.productLabel} — finalize seu pedido`,
    html,
    tags: [
      { name: "type", value: "abandoned_cart" },
      { name: "product", value: brand.slug },
    ],
  });
}
