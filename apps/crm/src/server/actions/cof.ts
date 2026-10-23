"use server";

import { db } from "@/lib/db";
import { assertTenantAccess } from "@/lib/dashboard-context";
import { getSession } from "@/lib/auth-server";
import { getConversationByLeadId, sendWhatsAppMessage } from "./conversation";
import nodemailer from "nodemailer";

const COF_URL = "https://lp.regicenter.com/lp/regicenter-franquia/assets/COF-2025.pdf";
const COF_PDF_URL = "https://lp.regicenter.com/lp/regicenter-franquia/assets/COF-2025.pdf";

const COF_WA_MESSAGE = (name: string) =>
  `Olá ${name}! 👋\n\nSegue a Circular de Oferta de Franquia (COF) da Regicenter, conforme exigido pela Lei 13.966/2019.\n\n📄 Acesse o documento completo aqui:\n${COF_URL}\n\n📥 Ou baixe o PDF diretamente:\n${COF_PDF_URL}\n\nQualquer dúvida, estamos à disposição!\n\nEquipe Regicenter\ncontato@regicenter.com · 0800 789 0007`;

const COF_EMAIL_HTML = (name: string) => `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Circular de Oferta de Franquia — Regicenter</title>
</head>
<body style="margin:0;padding:0;background-color:#f4f4f5;font-family:Arial,Helvetica,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f4f4f5;padding:40px 0;">
    <tr>
      <td align="center">
        <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="background-color:#ffffff;border-radius:8px;overflow:hidden;box-shadow:0 2px 8px rgba(0,0,0,0.08);">
          <!-- Header -->
          <tr>
            <td style="background-color:#0066cc;padding:32px 40px;text-align:center;">
              <h1 style="margin:0;color:#ffffff;font-size:24px;font-weight:600;">Regicenter</h1>
              <p style="margin:8px 0 0;color:#e0e7ff;font-size:14px;">Marcas &amp; Patentes</p>
            </td>
          </tr>
          <!-- Body -->
          <tr>
            <td style="padding:40px;">
              <h2 style="margin:0 0 16px;color:#111827;font-size:20px;font-weight:600;">
                Circular de Oferta de Franquia (COF)
              </h2>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Olá, <strong>${name}</strong>!
              </p>
              <p style="margin:0 0 16px;color:#374151;font-size:15px;line-height:1.6;">
                Conforme exigido pela Lei 13.966/2019, encaminhamos a Circular de Oferta de Franquia (COF) da Regicenter. Este documento contém informações completas sobre o modelo de franquia, investimento inicial, royalties, obrigações, suporte e condições gerais.
              </p>
              <p style="margin:0 0 24px;color:#374151;font-size:15px;line-height:1.6;">
                Recomendamos a leitura atenta antes de tomar qualquer decisão. Em caso de dúvidas, nossa equipe está à disposição.
              </p>
              <!-- CTA Button -->
              <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 auto 24px;">
                <tr>
                  <td style="background-color:#0066cc;border-radius:6px;">
                    <a href="${COF_URL}" target="_blank" rel="noopener noreferrer"
                       style="display:inline-block;padding:14px 32px;color:#ffffff;font-size:16px;font-weight:600;text-decoration:none;">
                      Acessar a COF Online
                    </a>
                  </td>
                </tr>
              </table>
              <p style="margin:0 0 8px;color:#6b7280;font-size:13px;text-align:center;">
                Ou baixe o PDF diretamente:
              </p>
              <p style="margin:0 0 24px;text-align:center;">
                <a href="${COF_PDF_URL}" target="_blank" rel="noopener noreferrer"
                   style="color:#0066cc;font-size:13px;text-decoration:underline;">
                  COF-Regicenter-2025.pdf
                </a>
              </p>
              <!-- Info box -->
              <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#f0f9ff;border-left:4px solid #0066cc;border-radius:4px;margin-bottom:24px;">
                <tr>
                  <td style="padding:16px;">
                    <p style="margin:0;color:#1e40af;font-size:13px;line-height:1.5;">
                      <strong>Importante:</strong> A COF deve ser entregue com pelo menos 10 dias de antecedência à assinatura do contrato de franquia, conforme a Lei 13.966/2019.
                    </p>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <!-- Footer -->
          <tr>
            <td style="background-color:#f9fafb;padding:24px 40px;text-align:center;border-top:1px solid #e5e7eb;">
              <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">
                Regicenter do Brasil Ltda · CNPJ 33.866.653/0001-07
              </p>
              <p style="margin:0 0 4px;color:#6b7280;font-size:13px;">
                Rua Coronel Procópio Gomes de Oliveira, 210, sala 906, Centro — Jaraguá do Sul/SC
              </p>
              <p style="margin:0;color:#6b7280;font-size:13px;">
                contato@regicenter.com · 0800 789 0007
              </p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>
`;

export async function sendCofToLead(leadId: string, tenantId: string) {
  const session = await getSession();
  if (!session?.user) throw new Error("Não autorizado");
  await assertTenantAccess(tenantId);

  const lead = await db.lead.findFirst({
    where: { id: leadId, tenantId, deletedAt: null },
  });
  if (!lead) throw new Error("Lead não encontrado.");
  if (!lead.email) throw new Error("Lead sem e-mail cadastrado.");

  const results: { whatsapp?: string; email?: string } = {};

  // 1. WhatsApp — enviar na conversa existente ou criar mensagem
  try {
    const conv = await getConversationByLeadId(leadId, tenantId);
    if (conv) {
      await sendWhatsAppMessage(tenantId, conv.id, COF_WA_MESSAGE(lead.name));
      results.whatsapp = "enviado";
    } else {
      results.whatsapp = "sem conversa vinculada";
    }
  } catch (err) {
    results.whatsapp = `erro: ${err instanceof Error ? err.message : String(err)}`;
  }

  // 2. E-mail — via nodemailer (SMTP do tenant ou env)
  try {
    const smtpHost = process.env.SMTP_HOST;
    const smtpPort = Number(process.env.SMTP_PORT || 587);
    const smtpUser = process.env.SMTP_USER;
    const smtpPass = process.env.SMTP_PASS;
    const fromEmail = process.env.SMTP_FROM || "contato@regicenter.com";

    if (!smtpHost || !smtpUser || !smtpPass) {
      results.email = "SMTP não configurado (defina SMTP_HOST, SMTP_USER, SMTP_PASS)";
    } else {
      const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: smtpPort === 465,
        auth: { user: smtpUser, pass: smtpPass },
      });

      await transporter.sendMail({
        from: `"Regicenter" <${fromEmail}>`,
        to: lead.email,
        subject: "Circular de Oferta de Franquia (COF) — Regicenter",
        html: COF_EMAIL_HTML(lead.name),
      });
      results.email = "enviado";
    }
  } catch (err) {
    results.email = `erro: ${err instanceof Error ? err.message : String(err)}`;
  }

  // Registrar atividade
  await db.activity.create({
    data: {
      tenantId,
      leadId,
      userId: (session.user as { id?: string }).id ?? null,
      type: "NOTE",
      content: `COF enviada — WhatsApp: ${results.whatsapp}, E-mail: ${results.email}`,
    },
  });

  return results;
}