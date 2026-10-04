/**
 * Renderizador único de e-mail (HTML table-based + texto puro), padrão Hostax template.js.
 * Blocos não carregam estilo: trocar o tema muda todos os e-mails de forma consistente.
 * Mesmo código gera envio, preview e re-render da aba Envios (a partir do contentSnapshot).
 */

import type { EmailBlock, EmailContent, RenderContext, RenderItem } from "@/lib/flows/types";
import { fontStack, type EmailThemeConfig } from "@/lib/flows/theme";
import { formatMoney, interpolate, variableValues } from "@/lib/flows/variables";

export const GMAIL_CLIP_BYTES = 102_000;

function esc(s: string) {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

/** Texto do bloco: escapa, **negrito**, quebras de linha e parágrafos. */
function richText(text: string) {
  return esc(text)
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, "<br>"))
    .join("</p><p style=\"margin:0 0 14px 0\">");
}

function plain(text: string) {
  return text.replace(/\*\*(.+?)\*\*/g, "$1");
}

const MAX_BLOCKS = 30;
const MAX_TEXT = 4000;

/** Sanitiza conteúdo vindo do editor (tipos conhecidos, limites de tamanho). */
export function sanitizeEmailContent(raw: unknown): EmailContent {
  const r = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const blocksRaw = Array.isArray(r.blocks) ? r.blocks.slice(0, MAX_BLOCKS) : [];
  const t = (v: unknown, max = MAX_TEXT) => (typeof v === "string" ? v.slice(0, max) : "");
  const blocks: EmailBlock[] = [];
  for (const b of blocksRaw) {
    if (!b || typeof b !== "object") continue;
    const x = b as Record<string, unknown>;
    switch (x.type) {
      case "heading":
        blocks.push({ type: "heading", text: t(x.text, 300) });
        break;
      case "text":
        blocks.push({ type: "text", text: t(x.text) });
        break;
      case "items":
        blocks.push({ type: "items", title: t(x.title, 200) || undefined });
        break;
      case "coupon":
        blocks.push({ type: "coupon", text: t(x.text, 300) || undefined, expires: t(x.expires, 120) || undefined });
        break;
      case "recommendations":
        blocks.push({
          type: "recommendations",
          title: t(x.title, 200) || undefined,
          limit: Math.min(6, Math.max(2, Number(x.limit) || 4)),
        });
        break;
      case "button":
        blocks.push({ type: "button", label: t(x.label, 60), url: t(x.url, 1000) || undefined });
        break;
      case "image": {
        const src = t(x.src, 1000);
        if (/^https:\/\//i.test(src)) {
          blocks.push({ type: "image", src, alt: t(x.alt, 200) || undefined, href: t(x.href, 1000) || undefined });
        }
        break;
      }
      case "divider":
        blocks.push({ type: "divider" });
        break;
      case "signature":
        blocks.push({ type: "signature" });
        break;
    }
  }
  return { subject: t(r.subject, 200), preheader: t(r.preheader, 200) || undefined, blocks };
}

/** Pendências do conteúdo (trava "teste antes de ativar", Hostax stepProblems). */
export function emailContentProblems(content: EmailContent): string[] {
  const problems: string[] = [];
  if (!content.subject.trim()) problems.push("Sem assunto");
  const hasBody = content.blocks.some(
    (b) => (b.type === "text" || b.type === "heading") && b.text.trim(),
  );
  if (!hasBody) problems.push("Sem conteúdo");
  for (const b of content.blocks) {
    if (b.type === "button" && !b.label.trim()) problems.push("Botão sem texto");
  }
  return problems;
}

type RenderInput = {
  theme: EmailThemeConfig;
  content: EmailContent;
  ctx: RenderContext;
};

export function renderEmail({ theme, content, ctx }: RenderInput) {
  const vars = variableValues(ctx);
  const tx = (s: string) => interpolate(s, vars);
  const c = theme.colors;
  const font = fontStack(theme.font);
  const subject = tx(content.subject).trim() || ctx.storeName;
  const preheader = content.preheader ? tx(content.preheader) : "";

  const html: string[] = [];
  const text: string[] = [];

  const button = (label: string, href: string) => {
    const lbl = theme.buttonUppercase ? label.toUpperCase() : label;
    return `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:8px 0 18px 0"><tr><td style="border-radius:${theme.buttonRadius}px;background:${c.accent}"><a href="${esc(href)}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:16px;font-weight:600;color:${c.buttonText};text-decoration:none;border-radius:${theme.buttonRadius}px">${esc(lbl)}</a></td></tr></table>`;
  };

  const productRow = (item: RenderItem) => {
    const href = ctx.trackUrl(item.productUrl || null, !item.productUrl);
    const img =
      theme.productCard.showImage && item.imageUrl
        ? `<td width="88" style="padding:8px 12px 8px 0;vertical-align:top"><a href="${esc(href)}"><img src="${esc(item.imageUrl)}" width="80" height="80" alt="${esc(item.title)}" style="display:block;width:80px;height:80px;object-fit:cover;border-radius:6px;border:0"></a></td>`
        : "";
    const qty = item.quantity && item.quantity > 1 ? `${item.quantity}x ` : "";
    const price =
      theme.productCard.showPrice && item.unitPriceCents != null
        ? `<div style="font-size:14px;color:${c.muted};margin-top:4px">${esc(formatMoney(item.unitPriceCents, ctx.currency))}</div>`
        : "";
    return `<tr>${img}<td style="padding:8px 0;vertical-align:top;font-family:${font};font-size:15px;color:${c.text}"><a href="${esc(href)}" style="color:${c.text};text-decoration:none;font-weight:600">${esc(qty + item.title)}</a>${price}</td></tr>`;
  };

  const COUPON_VAR = /\{\{\s*(cupom|validade)\s*\}\}/i;
  for (const b of content.blocks) {
    if (!ctx.couponCode && (b.type === "heading" || b.type === "text") && COUPON_VAR.test(b.text)) continue;
    switch (b.type) {
      case "heading": {
        const v = tx(b.text);
        if (!v.trim()) break;
        html.push(`<h1 style="margin:0 0 14px 0;font-family:${font};font-size:24px;line-height:1.25;font-weight:600;color:${c.text}">${esc(v)}</h1>`);
        text.push(v.toUpperCase(), "");
        break;
      }
      case "text": {
        const v = tx(b.text);
        if (!v.trim()) break;
        html.push(`<p style="margin:0 0 14px 0;font-family:${font};font-size:16px;line-height:1.55;color:${c.text}">${richText(v)}</p>`);
        text.push(plain(v), "");
        break;
      }
      case "items": {
        if (!ctx.items.length) break;
        const title = b.title ? tx(b.title) : "";
        html.push(
          `${title ? `<p style="margin:8px 0 6px 0;font-family:${font};font-size:14px;font-weight:600;color:${c.muted}">${esc(title)}</p>` : ""}<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0;border-top:1px solid #e5e5ea;border-bottom:1px solid #e5e5ea">${ctx.items.slice(0, 6).map(productRow).join("")}</table>`,
        );
        if (title) text.push(title);
        for (const i of ctx.items.slice(0, 6)) {
          text.push(`- ${i.quantity && i.quantity > 1 ? `${i.quantity}x ` : ""}${i.title}${i.unitPriceCents != null ? ` (${formatMoney(i.unitPriceCents, ctx.currency)})` : ""}`);
        }
        if (ctx.totalCents != null) text.push(`Total: ${formatMoney(ctx.totalCents, ctx.currency)}`);
        text.push("");
        break;
      }
      case "coupon": {
        if (!ctx.couponCode) break;
        const label = b.text ? tx(b.text) : "Use o cupom";
        const expires = b.expires ? tx(b.expires) : ctx.couponExpires ?? "";
        const border = theme.couponStyle === "dashed" ? `2px dashed ${c.accent}` : `2px solid ${c.accent}`;
        html.push(
          `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:6px 0 18px 0"><tr><td align="center" style="border:${border};border-radius:8px;padding:16px;font-family:${font}"><div style="font-size:14px;color:${c.muted}">${esc(label)}</div><div style="font-size:26px;font-weight:600;letter-spacing:2px;color:${c.accent};margin:6px 0">${esc(ctx.couponCode)}</div>${expires ? `<div style="font-size:13px;color:${c.muted}">${esc(expires)}</div>` : ""}</td></tr></table>`,
        );
        text.push(`${label}: ${ctx.couponCode}${expires ? ` (${expires})` : ""}`, "");
        break;
      }
      case "recommendations": {
        const recs = ctx.recommendations.filter((r) => r.imageUrl && r.productUrl).slice(0, b.limit ?? 4);
        if (!recs.length) break;
        const title = b.title ? tx(b.title) : "Você também pode gostar";
        const cells = recs.map((r) => {
          const href = ctx.trackUrl(r.productUrl);
          return `<td width="50%" style="padding:6px;vertical-align:top;font-family:${font}"><a href="${esc(href)}" style="text-decoration:none;color:${c.text}"><img src="${esc(String(r.imageUrl))}" width="250" alt="${esc(r.title)}" style="display:block;width:100%;max-width:250px;height:auto;border-radius:6px;border:0"><div style="font-size:14px;font-weight:600;margin-top:6px">${esc(r.title)}</div>${theme.productCard.showPrice && r.unitPriceCents != null ? `<div style="font-size:13px;color:${c.muted}">${esc(formatMoney(r.unitPriceCents, ctx.currency))}</div>` : ""}</a></td>`;
        });
        const rows: string[] = [];
        for (let i = 0; i < cells.length; i += 2) {
          rows.push(`<tr>${cells[i]}${cells[i + 1] ?? '<td width="50%"></td>'}</tr>`);
        }
        html.push(
          `<p style="margin:10px 0 4px 0;font-family:${font};font-size:16px;font-weight:600;color:${c.text}">${esc(title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px 0">${rows.join("")}</table>`,
        );
        text.push(title);
        for (const r of recs) text.push(`- ${r.title}: ${ctx.trackUrl(r.productUrl)}`);
        text.push("");
        break;
      }
      case "button": {
        const label = tx(b.label).trim();
        if (!label) break;
        const rawUrl = b.url ? tx(b.url) : "";
        const href = rawUrl && rawUrl !== ctx.primaryUrl ? ctx.trackUrl(rawUrl) : ctx.trackUrl(null, true);
        html.push(button(label, href));
        text.push(`${label}: ${href}`, "");
        break;
      }
      case "image": {
        const img = `<img src="${esc(b.src)}" alt="${esc(b.alt ?? "")}" width="560" style="display:block;width:100%;max-width:560px;height:auto;border:0;border-radius:6px">`;
        html.push(
          `<div style="margin:0 0 16px 0">${b.href ? `<a href="${esc(ctx.trackUrl(tx(b.href)))}">${img}</a>` : img}</div>`,
        );
        break;
      }
      case "divider":
        html.push(`<hr style="border:0;border-top:1px solid #e5e5ea;margin:18px 0">`);
        text.push("---", "");
        break;
      case "signature": {
        const s = theme.signature;
        if (!s.name) break;
        html.push(
          `<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:14px 0 4px 0"><tr>${s.photoUrl ? `<td style="padding-right:12px"><img src="${esc(s.photoUrl)}" width="44" height="44" alt="${esc(s.name)}" style="display:block;border-radius:22px;border:0"></td>` : ""}<td style="font-family:${font};font-size:14px;color:${c.text}"><div style="font-weight:600">${esc(s.name)}</div>${s.role ? `<div style="color:${c.muted}">${esc(s.role)}</div>` : ""}</td></tr></table>`,
        );
        text.push(s.name + (s.role ? ` — ${s.role}` : ""), "");
        break;
      }
    }
  }

  const socialLabels: Record<string, string> = {
    instagram: "Instagram",
    facebook: "Facebook",
    tiktok: "TikTok",
    youtube: "YouTube",
    whatsapp: "WhatsApp",
    site: "Site",
  };
  const socials = Object.entries(theme.footer.socials ?? {})
    .filter(([, url]) => typeof url === "string" && /^https?:\/\//i.test(url))
    .map(
      ([k, url]) =>
        `<a href="${esc(String(url))}" style="color:${c.muted};text-decoration:underline;margin:0 6px">${socialLabels[k] ?? k}</a>`,
    )
    .join("");

  const logo = theme.logoUrl
    ? `<img src="${esc(theme.logoUrl)}" width="${theme.logoWidth}" alt="${esc(ctx.storeName)}" style="display:inline-block;width:${theme.logoWidth}px;max-width:100%;height:auto;border:0">`
    : `<span style="font-family:${font};font-size:20px;font-weight:600;color:${c.text}">${esc(ctx.storeName)}</span>`;

  const footer = [
    socials ? `<div style="margin-bottom:10px">${socials}</div>` : "",
    theme.footer.address ? `<div>${esc(theme.footer.address)}</div>` : "",
    theme.footer.legal ? `<div style="margin-top:6px">${esc(theme.footer.legal)}</div>` : "",
    `<div style="margin-top:10px">Não quer mais receber? <a href="${esc(ctx.unsubscribeUrl)}" style="color:${c.muted};text-decoration:underline">Descadastrar</a></div>`,
  ].join("");

  const doc = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><meta name="supported-color-schemes" content="light"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.background}">
${preheader ? `<div style="display:none;max-height:0;overflow:hidden;opacity:0;color:transparent">${esc(preheader)}&#8199;&#65279;&#847;&#8199;&#65279;&#847;</div>` : ""}
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td align="${theme.headerAlign}" style="background:${theme.headerBg};padding:22px 28px;border-radius:10px 10px 0 0">${logo}</td></tr>
<tr><td style="background:${c.card};padding:28px 28px 18px 28px">${html.join("\n")}</td></tr>
<tr><td align="center" style="padding:20px 28px;font-family:${font};font-size:12px;line-height:1.5;color:${c.muted}">${footer}</td></tr>
</table></td></tr></table>
</body></html>`;

  text.push("--", ctx.storeName);
  if (theme.footer.address) text.push(theme.footer.address);
  text.push(`Descadastrar: ${ctx.unsubscribeUrl}`);

  return {
    subject,
    preheader,
    html: doc,
    text: text.join("\n").replace(/\n{3,}/g, "\n\n").trim(),
    bytes: Buffer.byteLength(doc, "utf8"),
  };
}

/** Headers RFC 8058 (List-Unsubscribe one-click). */
export function listUnsubscribeHeaders(unsubscribeUrl: string): Record<string, string> {
  return {
    "List-Unsubscribe": `<${unsubscribeUrl}/confirm>`,
    "List-Unsubscribe-Post": "List-Unsubscribe=One-Click",
  };
}
