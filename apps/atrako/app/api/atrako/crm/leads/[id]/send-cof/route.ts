import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { sendWhatsAppMessage } from "@/lib/flows/send";
import { loadEmailTheme } from "@/lib/flows/theme";
import { sendResendEmail } from "@/lib/integrations/resend/client";
import { formatFrom, resendReady, resolvePlatformResend, resolveResend } from "@/lib/integrations/resend/connection";
import { isWithinCustomerWindow, normalizeWaPhone, sendAndPersistCta } from "@/lib/whatsapp/domain";

const COF_URL = "https://lp.regicenter.com/lp/regicenter-franquia/assets/COF-2025.pdf";

type Ctx = { params: Promise<{ id: string }> };

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function POST(request: NextRequest, ctx: Ctx) {
  const { id } = await ctx.params;
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;

  const lead = await prisma.nativeLead.findFirst({
    where: { id, clienteId: g.workspaceId },
    select: {
      id: true,
      contact: { select: { id: true, name: true, email: true, phone: true, phoneE164: true, waOptOutAt: true } },
    },
  });
  if (!lead) return bad("Lead não encontrado", 404);
  let contact = lead.contact;
  if (!contact?.id) {
    // Garante que o lead tenha um contato vinculado para registrar na jornada
    try {
      const newContact = await prisma.nativeContact.create({
        data: {
          clienteId: g.workspaceId,
          name: lead.id ? "Lead" : "Lead",
          email: null,
          phone: null,
        },
      });
      await prisma.nativeLead.update({
        where: { id: lead.id },
        data: { contactId: newContact.id },
      });
      contact = { id: newContact.id, name: newContact.name, email: newContact.email, phone: newContact.phone, phoneE164: null, waOptOutAt: null };
    } catch (err) {
      console.error("[send-cof] failed to create contact", err instanceof Error ? err.message : err);
    }
  }
  const who = contact?.name?.trim().split(/\s+/)[0] || "";

  const results: { whatsapp?: { ok: boolean; detail: string }; email?: { ok: boolean; detail: string } } = {};

  // WhatsApp
  if (contact) {
    const raw = contact.phoneE164 || contact.phone;
    const phone = raw ? normalizeWaPhone(raw) : "";
    if (phone.length < 10) {
      results.whatsapp = { ok: false, detail: "Lead sem telefone." };
    } else if (contact.waOptOutAt) {
      results.whatsapp = { ok: false, detail: "O lead pediu para não receber WhatsApp." };
    } else {
      const conversation = await prisma.waConversation.findUnique({
        where: { clienteId_phone: { clienteId: g.workspaceId, phone } },
        select: { windowExpiresAt: true },
      });
      if (isWithinCustomerWindow(conversation?.windowExpiresAt)) {
        try {
          await sendAndPersistCta({
            workspaceId: g.workspaceId,
            to: phone,
            body: `${who ? `${who}, ` : ""}segue a Circular de Oferta de Franquia (COF) da Regicenter.\nAcesse: ${COF_URL}`,
            buttonText: "Acessar COF",
            url: COF_URL,
            contactId: contact.id,
            contactName: contact.name,
          });
          results.whatsapp = { ok: true, detail: "Enviado na conversa do WhatsApp." };
        } catch (err) {
          results.whatsapp = { ok: false, detail: err instanceof Error ? err.message : "Falha no WhatsApp." };
        }
      } else {
        const sent = await sendWhatsAppMessage({
          clienteId: g.workspaceId,
          contact,
          content: { purpose: "order_unpaid" },
          data: { destination: COF_URL, orderRef: "COF", totalCents: 0, storeName: "Regicenter" },
          origin: {},
          automatic: true,
          reservePercent: 0,
        }).catch((err) => ({ status: "FAILED" as const, reason: err instanceof Error ? err.message : "falha" }));
        if (sent.status === "SENT") results.whatsapp = { ok: true, detail: "Enviado pelo modelo." };
        else results.whatsapp = { ok: false, detail: ("reason" in sent && typeof sent.reason === "string" ? sent.reason : "") || "WhatsApp não enviado." };
      }
    }
  } else {
    results.whatsapp = { ok: false, detail: "Lead sem contato." };
  }

  // Email
  const to = (contact?.email ?? "").trim().toLowerCase();
  if (!EMAIL_RE.test(to)) {
    results.email = { ok: false, detail: "Lead sem e-mail válido." };
  } else {
    const conn = await resolveResend(g.workspaceId);
    const platform = resendReady(conn) ? null : await resolvePlatformResend();
    if (!resendReady(conn) && !platform) {
      results.email = { ok: false, detail: "E-mail não configurado." };
    } else {
      const { theme, brand } = await loadEmailTheme(g.workspaceId);
      const c = theme.colors;
      const font = theme.font;
      const logo = theme.logoUrl
        ? `<img src="${esc(theme.logoUrl)}" width="${theme.logoWidth}" alt="${esc(brand.storeName)}" style="display:inline-block;width:${theme.logoWidth}px;max-width:100%;height:auto;border:0">`
        : `<span style="font-family:${font};font-size:20px;font-weight:600;color:${c.text}">${esc(brand.storeName)}</span>`;
      const subject = `${brand.storeName}: Circular de Oferta de Franquia (COF)`.slice(0, 200);
      const html = `<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(subject)}</title></head><body style="margin:0;padding:0;background:${c.background}"><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.background}"><tr><td align="center" style="padding:24px 12px"><table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px"><tr><td align="${theme.headerAlign}" style="background:${theme.headerBg};padding:22px 28px;border-radius:10px 10px 0 0">${logo}</td></tr><tr><td style="background:${c.card};padding:30px 28px 26px 28px"><p style="margin:0 0 14px 0;font-family:${font};font-size:16px;line-height:1.6;color:${c.text}">${who ? `Olá, ${esc(who)}.` : "Olá."}</p><p style="margin:0 0 18px 0;font-family:${font};font-size:16px;line-height:1.6;color:${c.text}">Segue a Circular de Oferta de Franquia (COF) da Regicenter.</p><table role="presentation" cellpadding="0" cellspacing="0" border="0"><tr><td style="border-radius:${theme.buttonRadius}px;background:${c.accent}"><a href="${esc(COF_URL)}" style="display:inline-block;padding:14px 30px;font-family:${font};font-size:16px;font-weight:600;color:${c.buttonText};text-decoration:none;border-radius:${theme.buttonRadius}px">Acessar COF</a></td></tr></table><p style="margin:18px 0 0 0;font-family:${font};font-size:13px;line-height:1.6;color:${c.muted}">Se o botão não abrir, copie este endereço: <a href="${esc(COF_URL)}" style="color:${c.muted}">${esc(COF_URL)}</a></p></td></tr></table></td></tr></table></body></html>`;
      try {
        const apiKey = resendReady(conn) ? conn.apiKey : platform!.apiKey;
        const from = resendReady(conn) ? formatFrom(conn, brand.storeName) : platform!.from;
        const resendRes = await sendResendEmail(apiKey, { from, to: [to], subject, html, text: `Olá ${who}. Segue a COF: ${COF_URL}`, tags: [{ name: "kind", value: "cof" }] }, `cof-${lead.id}-${Date.now().toString(36)}`);
        if (contact?.id) {
          const delivery = await prisma.messageDelivery.create({
            data: {
              clienteId: g.workspaceId,
              channel: "EMAIL",
              contactId: contact.id,
              toAddress: to,
              subject: subject.slice(0, 300),
              status: "SENT",
              sentAt: new Date(),
              providerMessageId: resendRes.id,
              isTest: false,
              trackingToken: `cof-${lead.id}-${Date.now().toString(36)}`,
            },
          }).catch((err) => {
            console.error("[send-cof] failed to create MessageDelivery", err instanceof Error ? err.message : err);
            return null;
          });
          if (!delivery) {
            console.warn("[send-cof] MessageDelivery not created for lead", lead.id);
          }
        } else {
          console.warn("[send-cof] no contact.id for lead", lead.id);
        }
        results.email = { ok: true, detail: `Enviado para ${to}.` };
      } catch (err) {
        results.email = { ok: false, detail: err instanceof Error ? err.message : "Falha no e-mail." };
      }
    }
  }

  return NextResponse.json({ ok: true, results });
}
