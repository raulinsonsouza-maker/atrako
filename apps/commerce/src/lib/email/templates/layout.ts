import type { EmailBrand } from "@/lib/email/brands";

export function renderEmailLayout(input: {
  brand: EmailBrand;
  preheader: string;
  title: string;
  bodyHtml: string;
  ctaLabel: string;
  ctaHref: string;
  secondaryHtml?: string;
}) {
  const { brand } = input;
  const secondary = input.secondaryHtml
    ? `<p style="margin:18px 0 0;font-size:13px;line-height:1.5;color:${brand.muted};text-align:center">${input.secondaryHtml}</p>`
    : "";

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${escapeHtml(input.title)}</title>
</head>
<body style="margin:0;padding:0;background:${brand.paper};color:${brand.ink};">
  <div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">
    ${escapeHtml(input.preheader)}
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:${brand.paper};padding:28px 12px">
    <tr>
      <td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:14px;overflow:hidden;border:1px solid rgba(0,0,0,0.08)">
          <tr>
            <td style="padding:18px 24px;background:${brand.accent}">
              <p style="margin:0;font-family:Georgia,'Times New Roman',serif;font-size:13px;letter-spacing:0.08em;text-transform:uppercase;color:rgba(255,255,255,0.88)">Prospect Ads</p>
              <h1 style="margin:6px 0 0;font-family:Georgia,'Times New Roman',serif;font-size:22px;line-height:1.2;font-weight:600;color:#ffffff">${escapeHtml(brand.productLabel)}</h1>
            </td>
          </tr>
          <tr>
            <td style="padding:28px 24px 8px;font-family:Arial,Helvetica,sans-serif">
              ${input.bodyHtml}
            </td>
          </tr>
          <tr>
            <td align="center" style="padding:8px 24px 28px;font-family:Arial,Helvetica,sans-serif">
              <a href="${escapeAttr(input.ctaHref)}" style="display:inline-block;background:${brand.accent};color:#ffffff;text-decoration:none;font-weight:700;font-size:16px;line-height:1;padding:16px 28px;border-radius:8px">
                ${escapeHtml(input.ctaLabel)}
              </a>
              ${secondary}
            </td>
          </tr>
          <tr>
            <td style="padding:18px 24px;border-top:1px solid rgba(0,0,0,0.08);font-family:Arial,Helvetica,sans-serif;font-size:12px;line-height:1.5;color:${brand.muted}">
              Dúvidas? Responda este e-mail ou fale com
              <a href="mailto:vendas@prospectads.com.br" style="color:${brand.accentDeep};text-decoration:none">vendas@prospectads.com.br</a>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

export function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

export function escapeAttr(value: string) {
  return escapeHtml(value).replace(/'/g, "&#39;");
}
