/**
 * Envio do link de pagamento ao lead: WhatsApp (botão na janela de 24h, template `order_unpaid` fora dela)
 * e e-mail no tema publicado da loja (Resend do workspace).
 */

import { prisma } from "@/lib/db";
import { loadEmailTheme, fontStack } from "@/lib/flows/theme";
import { loadMessagingPrefs } from "@/lib/flows/prefs";
import { sendWhatsAppMessage } from "@/lib/flows/send";
import { sendResendEmail } from "@/lib/integrations/resend/client";
import { formatFrom, resendReady, resolvePlatformResend, resolveResend } from "@/lib/integrations/resend/connection";
import { isWithinCustomerWindow, normalizeWaPhone, sendAndPersistCta } from "@/lib/whatsapp/domain";
import { shortLinkRef } from "@/lib/crm/payment-link-rules";
import { urlForPaymentLink } from "@/lib/crm/payment-links";

export type PaymentLinkChannel = "whatsapp" | "email";
export type ChannelResult = { ok: boolean; detail: string };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
const brl = (cents: number) => (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const firstName = (name: string | null | undefined) => (name ?? "").trim().split(/\s+/)[0] || "";

const WA_SKIP_REASONS: Record<string, string> = {
  whatsapp_not_connected: "WhatsApp não conectado.",
  no_phone: "Lead sem telefone.",
  wa_opt_out: "O lead pediu para não receber WhatsApp.",
  wa_undeliverable: "Número sem WhatsApp.",
  template_missing: "Fora da janela de 24h e o modelo “Pagar pedido” não está aprovado.",
  template_pending: "Fora da janela de 24h e o modelo “Pagar pedido” ainda está em análise.",
  portfolio_limit: "Limite diário de mensagens do WhatsApp atingido.",
};

function installmentsLine(maxInstallments: number) {
  return maxInstallments > 1 ? `em até ${maxInstallments}x no cartão ou Pix` : "no Pix ou cartão";
}

async function sendWhatsApp(input: {
  workspaceId: string;
  contact: {
    id: string;
    name: string | null;
    email: string | null;
    phone: string | null;
    phoneE164: string | null;
    waOptOutAt: Date | null;
  };
  url: string;
  amountCents: number;
  maxInstallments: number;
  description: string;
  ref: string;
  storeName: string;
}): Promise<ChannelResult> {
  const raw = input.contact.phoneE164 || input.contact.phone;
  const phone = raw ? normalizeWaPhone(raw) : "";
  if (phone.length < 10) return { ok: false, detail: WA_SKIP_REASONS.no_phone };
  if (input.contact.waOptOutAt) return { ok: false, detail: WA_SKIP_REASONS.wa_opt_out };

  const conversation = await prisma.waConversation.findUnique({
    where: { clienteId_phone: { clienteId: input.workspaceId, phone } },
    select: { windowExpiresAt: true },
  });
  if (isWithinCustomerWindow(conversation?.windowExpiresAt)) {
    const who = firstName(input.contact.name);
    const body = [
      `${who ? `${who}, ` : ""}segue o link para o pagamento de ${input.description}.`,
      `Valor: ${brl(input.amountCents)} ${installmentsLine(input.maxInstallments)}.`,
      "O pagamento é feito em ambiente seguro do Mercado Pago.",
    ].join("\n");
    try {
      await sendAndPersistCta({
        workspaceId: input.workspaceId,
        to: phone,
        body,
        buttonText: "Pagar agora",
        url: input.url,
        contactId: input.contact.id,
        contactName: input.contact.name,
      });
      return { ok: true, detail: "Enviado na conversa do WhatsApp." };
    } catch (err) {
      return { ok: false, detail: err instanceof Error ? err.message : "Falha no WhatsApp." };
    }
  }

  const { prefs } = await loadMessagingPrefs(input.workspaceId);
  const sent = await sendWhatsAppMessage({
    clienteId: input.workspaceId,
    contact: input.contact,
    content: { purpose: "order_unpaid" },
    data: {
      destination: input.url,
      orderRef: input.ref,
      totalCents: input.amountCents,
      storeName: input.storeName,
    },
    origin: {},
    automatic: true,
    reservePercent: prefs.waAutoReservePercent,
  }).catch((err) => ({ status: "FAILED" as const, reason: err instanceof Error ? err.message : "falha" }));
  if (sent.status === "SENT") return { ok: true, detail: "Enviado pelo modelo “Pagar pedido”." };
  const reason = "reason" in sent && typeof sent.reason === "string" ? sent.reason : "";
  return { ok: false, detail: WA_SKIP_REASONS[reason] || reason || "WhatsApp não enviado." };
}

async function sendEmail(input: {
  workspaceId: string;
  linkId: string;
  to: string;
  name: string | null;
  url: string;
  amountCents: number;
  maxInstallments: number;
  description: string;
  ref: string;
  replyTo: string | null;
}): Promise<ChannelResult> {
  if (!EMAIL_RE.test(input.to)) return { ok: false, detail: "Lead sem e-mail válido." };
  const conn = await resolveResend(input.workspaceId);
  const platform = resendReady(conn) ? null : await resolvePlatformResend();
  if (!resendReady(conn) && !platform) return { ok: false, detail: "E-mail não configurado." };

  const { theme, brand } = await loadEmailTheme(input.workspaceId);
  const c = theme.colors;
  const font = fontStack(theme.font);
  const who = firstName(input.name);
  const amount = brl(input.amountCents);
  const parcel =
    input.maxInstallments > 1
      ? `em até ${input.maxInstallments}x no cartão de crédito ou à vista no Pix`
      : "à vista no Pix ou no cartão de crédito";
  const label = theme.buttonUppercase ? "PAGAR AGORA" : "Pagar agora";
  const logo = theme.logoUrl
    ? `<img src="${esc(theme.logoUrl)}" width="${theme.logoWidth}" alt="${esc(brand.storeName)}" style="display:inline-block;width:${theme.logoWidth}px;max-width:100%;height:auto;border:0">`
    : `<span style="font-family:${font};font-size:20px;font-weight:600;color:${c.text}">${esc(brand.storeName)}</span>`;
  const footer = [theme.footer.address, theme.footer.legal].filter(Boolean).map((l) => esc(String(l))).join("<br>");
  const subject = `${brand.storeName}: link para pagamento de ${amount}`.slice(0, 200);
  const signature = theme.signature.name ? `<p style="margin:22px 0 0 0;font-family:${font};font-size:15px;line-height:1.6;color:${c.text}">${esc(theme.signature.name)}</p>` : "";

  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td align="${theme.headerAlign}" style="background:${theme.headerBg};padding:22px 28px;border-radius:10px 10px 0 0">${logo}</td></tr>
<tr><td style="background:${c.card};padding:30px 28px 26px 28px">
<p style="margin:0 0 14px 0;font-family:${font};font-size:16px;line-height:1.6;color:${c.text}">${who ? `Olá, ${esc(who)}.` : "Olá."}</p>
<p style="margin:0 0 18px 0;font-family:${font};font-size:16px;line-height:1.6;color:${c.text}">Conforme combinamos, segue o link para o pagamento de <strong>${esc(input.description)}</strong>.</p>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 22px 0;border:1px solid #e5e9f0;border-radius:8px"><tr><td style="padding:16px 18px">
<p style="margin:0;font-family:${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${c.muted}">Valor · Ref. ${esc(input.ref)}</p>
<p style="margin:4px 0 2px 0;font-family:${font};font-size:28px;font-weight:600;color:${c.text}">${esc(amount)}</p>
<p style="margin:0;font-family:${font};font-size:14px;color:${c.muted}">${esc(parcel)}</p>
</td></tr></table>
<table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:${theme.buttonRadius}px;background:${c.accent}"><a href="${esc(input.url)}" style="display:inline-block;padding:14px 30px;font-family:${font};font-size:16px;font-weight:600;color:${c.buttonText};text-decoration:none;border-radius:${theme.buttonRadius}px">${label}</a></td></tr></table>
<p style="margin:18px 0 0 0;font-family:${font};font-size:13px;line-height:1.6;color:${c.muted}">O pagamento é processado com segurança pelo Mercado Pago. O link vale por 7 dias. Se o botão não abrir, copie este endereço: <a href="${esc(input.url)}" style="color:${c.muted}">${esc(input.url)}</a></p>
${signature}
</td></tr>
<tr><td align="center" style="padding:18px 28px;font-family:${font};font-size:12px;line-height:1.5;color:${c.muted}">${footer || esc(brand.storeName)}</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    who ? `Olá, ${who}.` : "Olá.",
    "",
    `Conforme combinamos, segue o link para o pagamento de ${input.description}.`,
    `Valor: ${amount} (${parcel}).`,
    "",
    `Pagar agora: ${input.url}`,
    "",
    "O link vale por 7 dias.",
    theme.signature.name ?? "",
  ].join("\n");

  try {
    const apiKey = resendReady(conn) ? conn.apiKey : platform!.apiKey;
    const from = resendReady(conn) ? formatFrom(conn, brand.storeName) : platform!.from;
    await sendResendEmail(
      apiKey,
      {
        from,
        to: [input.to],
        subject,
        html,
        text,
        ...(input.replyTo && EMAIL_RE.test(input.replyTo) ? { reply_to: input.replyTo } : {}),
        tags: [{ name: "kind", value: "payment_link" }],
      },
      `paylink-${input.linkId}-${Date.now().toString(36)}`,
    );
    return { ok: true, detail: `Enviado para ${input.to}.` };
  } catch (err) {
    return { ok: false, detail: err instanceof Error ? err.message : "Falha no e-mail." };
  }
}

export async function sendPaymentLink(input: {
  workspaceId: string;
  linkId: string;
  channels: PaymentLinkChannel[];
  replyTo?: string | null;
}) {
  const link = await prisma.leadPaymentLink.findFirst({ where: { id: input.linkId, clienteId: input.workspaceId } });
  if (!link) return { ok: false as const, error: "Link não encontrado." };
  const lead = await prisma.nativeLead.findFirst({
    where: { id: link.leadId, clienteId: input.workspaceId },
    select: {
      contact: {
        select: { id: true, name: true, email: true, phone: true, phoneE164: true, waOptOutAt: true },
      },
    },
  });
  const contact = lead?.contact;
  const url = await urlForPaymentLink(link);
  const ref = shortLinkRef(link.id);
  const { brand } = await loadEmailTheme(input.workspaceId);
  const results: Partial<Record<PaymentLinkChannel, ChannelResult>> = {};

  if (input.channels.includes("whatsapp")) {
    results.whatsapp = contact
      ? await sendWhatsApp({
          workspaceId: input.workspaceId,
          contact,
          url,
          amountCents: link.amountCents,
          maxInstallments: link.maxInstallments,
          description: link.description,
          ref,
          storeName: brand.storeName,
        })
      : { ok: false, detail: "Lead sem contato." };
  }
  if (input.channels.includes("email")) {
    results.email = await sendEmail({
      workspaceId: input.workspaceId,
      linkId: link.id,
      to: (contact?.email ?? "").trim().toLowerCase(),
      name: contact?.name ?? null,
      url,
      amountCents: link.amountCents,
      maxInstallments: link.maxInstallments,
      description: link.description,
      ref,
      replyTo: input.replyTo ?? null,
    });
  }

  const delivered = (Object.entries(results) as Array<[PaymentLinkChannel, ChannelResult]>)
    .filter(([, r]) => r.ok)
    .map(([ch]) => ch);
  if (delivered.length) {
    await prisma.leadPaymentLink.update({
      where: { id: link.id },
      data: { sentVia: [...new Set([...link.sentVia, ...delivered])] },
    });
  }
  return { ok: true as const, url, results };
}
