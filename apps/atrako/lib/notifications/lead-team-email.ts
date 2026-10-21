/**
 * Aviso de lead novo por e-mail para a equipe (`WorkspaceSettings.notifyPrefs.leadEmails`).
 * Sai pelo Resend da loja com o tema de e-mail publicado; reply_to = e-mail do lead.
 * Uma vez por lead (`metadata.teamNotifiedAt` + Idempotency-Key no Resend).
 */

import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { loadEmailTheme, fontStack } from "@/lib/flows/theme";
import { sendResendEmail } from "@/lib/integrations/resend/client";
import { formatFrom, resendReady, resolvePlatformResend, resolveResend } from "@/lib/integrations/resend/connection";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import { lpHostForWorkspace } from "@/lib/lp-domains";
import { FIELD_DEFS } from "@/lib/qualification/fields";
import { parseLeadQualification } from "@/lib/qualification/store";
import { crmOriginDisplay, priorityHumanLabel } from "@/lib/qualification/crm-labels";

const EMAIL_RE = /^[^\s@<>]+@[^\s@<>]+\.[a-z]{2,}$/i;
const CONTACT_KEYS = new Set(["name", "email", "phone", "wa_opt_in"]);

const esc = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

function asRecord(raw: unknown): Record<string, unknown> {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : {};
}

function str(v: unknown) {
  return typeof v === "string" && v.trim() ? v.trim() : "";
}

export function parseLeadEmails(notifyPrefs: unknown): string[] {
  const list = asRecord(notifyPrefs).leadEmails;
  if (!Array.isArray(list)) return [];
  const out = new Set<string>();
  for (const v of list) {
    const e = typeof v === "string" ? v.trim().toLowerCase() : "";
    if (EMAIL_RE.test(e)) out.add(e);
  }
  return [...out].slice(0, 10);
}

export async function sendLeadTeamEmail(workspaceId: string, leadId: string) {
  const [settings, lead] = await Promise.all([
    prisma.workspaceSettings.findUnique({ where: { clienteId: workspaceId }, select: { notifyPrefs: true } }),
    prisma.nativeLead.findFirst({
      where: { id: leadId, clienteId: workspaceId },
      select: {
        id: true,
        source: true,
        metadata: true,
        createdAt: true,
        cliente: { select: { nome: true, slug: true } },
        contact: { select: { name: true, email: true, phone: true, phoneE164: true } },
      },
    }),
  ]);
  const to = parseLeadEmails(settings?.notifyPrefs);
  if (!to.length || !lead) return { sent: false as const, reason: "no_recipients" };
  const meta = asRecord(lead.metadata);
  if (meta.teamNotifiedAt) return { sent: false as const, reason: "already_notified" };

  const conn = await resolveResend(workspaceId);
  const platform = resendReady(conn) ? null : await resolvePlatformResend();
  if (!resendReady(conn) && !platform) return { sent: false as const, reason: "resend_not_ready" };

  const { theme, brand } = await loadEmailTheme(workspaceId);
  const c = theme.colors;
  const font = fontStack(theme.font);
  const q = parseLeadQualification(lead.metadata);

  const name = str(lead.contact?.name) || str(q.answers.name?.value) || "Lead sem nome";
  const email = str(lead.contact?.email) || str(q.answers.email?.value);
  const phone = str(lead.contact?.phoneE164) || str(lead.contact?.phone) || str(q.answers.phone?.value);
  const city = str(q.answers.city?.value);
  const state = str(q.answers.state?.value);
  const place = [city, state].filter(Boolean).join("/");
  const priority = priorityHumanLabel(q.priority);
  const origin = crmOriginDisplay({
    source: lead.source,
    formName: str(meta.formName) || null,
    campaignName: str(meta.campaignName) || null,
  });

  const host = lpHostForWorkspace(lead.cliente.slug);
  const leadUrl = host
    ? `https://${host}/crm/leads?lead=${encodeURIComponent(lead.id)}`
    : `${getServerPublicOrigin()}/atendimento/leads?lead=${encodeURIComponent(lead.id)}`;
  const waDigits = phone.replace(/\D/g, "");
  const waUrl = waDigits.length >= 10 ? `https://wa.me/${waDigits.length <= 11 ? `55${waDigits}` : waDigits}` : null;
  const when = lead.createdAt.toLocaleString("pt-BR", { timeZone: brand.timezone, dateStyle: "short", timeStyle: "short" });

  const answers: Array<[string, string]> = [];
  for (const def of FIELD_DEFS) {
    if (CONTACT_KEYS.has(def.key)) continue;
    const a = q.answers[def.key];
    const v = str(a?.label) || str(a?.value);
    if (v) answers.push([def.crmLabel, v]);
  }
  const tracking: Array<[string, string]> = [["Origem", origin]];
  for (const [label, key] of [
    ["Campanha", "campaignName"],
    ["Anúncio", "adName"],
    ["utm_source", "utm_source"],
    ["utm_medium", "utm_medium"],
    ["utm_campaign", "utm_campaign"],
    ["utm_content", "utm_content"],
    ["Página", "pageUrl"],
  ] as const) {
    const v = str(meta[key]);
    if (v) tracking.push([label, v]);
  }
  tracking.push(["Recebido em", when]);

  const row = ([label, value]: [string, string]) =>
    `<tr><td style="padding:9px 12px 9px 0;border-bottom:1px solid #e5e9f0;font-family:${font};font-size:13px;color:${c.muted};vertical-align:top;width:38%">${esc(label)}</td><td style="padding:9px 0;border-bottom:1px solid #e5e9f0;font-family:${font};font-size:15px;color:${c.text};vertical-align:top">${esc(value)}</td></tr>`;
  const section = (title: string, rows: Array<[string, string]>) =>
    rows.length
      ? `<p style="margin:22px 0 4px 0;font-family:${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${c.muted}">${esc(title)}</p><table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${rows.map(row).join("")}</table>`
      : "";
  const contactLine = [
    waUrl ? `<a href="${esc(waUrl)}" style="color:${c.text};font-weight:600">WhatsApp ${esc(phone)}</a>` : phone ? esc(phone) : "",
    email ? `<a href="mailto:${esc(email)}" style="color:${c.text};font-weight:600">${esc(email)}</a>` : "",
  ]
    .filter(Boolean)
    .join(`<span style="color:${c.muted}"> &nbsp;·&nbsp; </span>`);
  const badge = priority
    ? `<span style="display:inline-block;margin:0 0 12px 0;padding:4px 10px;border-radius:999px;background:${c.accent};color:${c.buttonText};font-family:${font};font-size:12px;font-weight:600">${esc(`Prioridade: ${priority}`)}</span><br>`
    : "";
  const logo = theme.logoUrl
    ? `<img src="${esc(theme.logoUrl)}" width="${theme.logoWidth}" alt="${esc(brand.storeName)}" style="display:inline-block;width:${theme.logoWidth}px;max-width:100%;height:auto;border:0">`
    : `<span style="font-family:${font};font-size:20px;font-weight:600;color:${c.text}">${esc(brand.storeName)}</span>`;

  const subject = `Novo lead: ${name}${place ? ` — ${place}` : ""}`.slice(0, 200);
  const html = `<!doctype html>
<html lang="pt-BR"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><meta name="color-scheme" content="light only"><title>${esc(subject)}</title></head>
<body style="margin:0;padding:0;background:${c.background}">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background:${c.background}"><tr><td align="center" style="padding:24px 12px">
<table role="presentation" width="600" cellpadding="0" cellspacing="0" border="0" style="width:100%;max-width:600px">
<tr><td align="${theme.headerAlign}" style="background:${theme.headerBg};padding:22px 28px;border-radius:10px 10px 0 0">${logo}</td></tr>
<tr><td style="background:${c.card};padding:28px 28px 24px 28px">
<p style="margin:0 0 6px 0;font-family:${font};font-size:12px;letter-spacing:.06em;text-transform:uppercase;color:${c.muted}">Novo lead · ${esc(origin)}</p>
<h1 style="margin:0 0 12px 0;font-family:${font};font-size:24px;line-height:1.25;font-weight:600;color:${c.text}">${esc(name)}</h1>
${badge}${contactLine ? `<p style="margin:0 0 4px 0;font-family:${font};font-size:15px;line-height:1.6;color:${c.text}">${contactLine}</p>` : ""}
${section("Qualificação", answers)}
${section("Origem", tracking)}
<table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:24px 0 4px 0"><tr><td style="border-radius:${theme.buttonRadius}px;background:${c.accent}"><a href="${esc(leadUrl)}" style="display:inline-block;padding:13px 26px;font-family:${font};font-size:16px;font-weight:600;color:${c.buttonText};text-decoration:none;border-radius:${theme.buttonRadius}px">Abrir no funil</a></td></tr></table>
</td></tr>
<tr><td align="center" style="padding:18px 28px;font-family:${font};font-size:12px;line-height:1.5;color:${c.muted}">Aviso automático para a equipe de ${esc(brand.storeName)}.${email ? " Responda este e-mail para falar direto com o lead." : ""}</td></tr>
</table></td></tr></table>
</body></html>`;

  const text = [
    `Novo lead: ${name}`,
    priority ? `Prioridade: ${priority}` : "",
    phone ? `WhatsApp: ${phone}` : "",
    email ? `E-mail: ${email}` : "",
    "",
    ...answers.map(([l, v]) => `${l}: ${v}`),
    "",
    ...tracking.map(([l, v]) => `${l}: ${v}`),
    "",
    `Abrir no funil: ${leadUrl}`,
  ]
    .filter((l, i, arr) => l || arr[i - 1])
    .join("\n");

  const apiKey = resendReady(conn) ? conn.apiKey : platform!.apiKey;
  const from = resendReady(conn) ? formatFrom(conn, brand.storeName) : platform!.from;
  const r = await sendResendEmail(
    apiKey,
    {
      from,
      to,
      subject,
      html,
      text,
      ...(EMAIL_RE.test(email) ? { reply_to: email } : {}),
      tags: [{ name: "kind", value: "lead_team" }],
    },
    `lead-team-${lead.id}`,
  );

  const fresh = await prisma.nativeLead.findUnique({ where: { id: lead.id }, select: { metadata: true } });
  await prisma.nativeLead.update({
    where: { id: lead.id },
    data: {
      metadata: { ...asRecord(fresh?.metadata), teamNotifiedAt: new Date().toISOString() } as Prisma.InputJsonValue,
    },
  });
  return { sent: true as const, id: r.id, to };
}
