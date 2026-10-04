/**
 * Avisos da plataforma: sino no AppSidebar, página /notificacoes e e-mail para a equipe
 * (avisos e urgentes, via app Resend da plataforma — não usa a chave da loja).
 */

import { prisma } from "@/lib/db";
import { resolvePlatformResend, resolveResend, resendReady, formatFrom } from "@/lib/integrations/resend/connection";
import { sendResendEmail } from "@/lib/integrations/resend/client";
import { getServerPublicOrigin } from "@/lib/http/public-origin";

export type NotificationSeverity = "info" | "aviso" | "urgente";
export type NotificationRole = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";

export type NotifyInput = {
  clienteId: string;
  type: string;
  title: string;
  body?: string | null;
  href?: string | null;
  severity?: NotificationSeverity;
  memberId?: string | null;
  role?: NotificationRole | null;
  /** Mesmo aviso não se repete (ex.: `campaign:{id}:D-15`). */
  dedupeKey?: string | null;
  /** Força/impede e-mail. Padrão: e-mail para aviso/urgente. */
  email?: boolean;
};

const escape = (s: string) =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

export async function notify(input: NotifyInput) {
  let row;
  try {
    row = await prisma.notification.create({
      data: {
        clienteId: input.clienteId,
        type: input.type.slice(0, 60),
        title: input.title.slice(0, 200),
        body: input.body ?? null,
        href: input.href?.slice(0, 300) ?? null,
        severity: input.severity ?? "info",
        memberId: input.memberId ?? null,
        role: input.role ?? null,
        dedupeKey: input.dedupeKey?.slice(0, 160) ?? null,
      },
    });
  } catch (err) {
    if ((err as { code?: string }).code === "P2002") return null;
    throw err;
  }
  const wantsEmail = input.email ?? (row.severity === "aviso" || row.severity === "urgente");
  if (wantsEmail) {
    await emailNotification(row.id).catch((err) =>
      console.warn("[notifications] email", err instanceof Error ? err.message : err),
    );
  }
  return row;
}

export type MemberNotifyPrefs = { email: boolean; urgentOnly: boolean };

/** Preferência por membro em `WorkspaceSettings.notifyPrefs.members[memberId]`. */
export async function memberNotifyPrefs(clienteId: string): Promise<Record<string, MemberNotifyPrefs>> {
  const s = await prisma.workspaceSettings.findUnique({ where: { clienteId }, select: { notifyPrefs: true } });
  const members = ((s?.notifyPrefs ?? {}) as { members?: Record<string, Partial<MemberNotifyPrefs>> }).members ?? {};
  const out: Record<string, MemberNotifyPrefs> = {};
  for (const [id, p] of Object.entries(members)) {
    out[id] = { email: p?.email !== false, urgentOnly: p?.urgentOnly === true };
  }
  return out;
}

async function recipientsFor(n: { clienteId: string; memberId: string | null; role: string | null; severity: string }) {
  const prefs = await memberNotifyPrefs(n.clienteId);
  const wants = (id: string) => {
    const p = prefs[id];
    if (!p) return true;
    if (!p.email) return false;
    return !p.urgentOnly || n.severity === "urgente";
  };
  if (n.memberId) {
    const m = await prisma.workspaceMember.findFirst({
      where: { id: n.memberId, active: true },
      select: { id: true, email: true },
    });
    return m && wants(m.id) ? [m.email] : [];
  }
  const roles = n.role ? [n.role] : ["OWNER", "ADMIN"];
  const members = await prisma.workspaceMember.findMany({
    where: { clienteId: n.clienteId, active: true, role: { in: roles as NotificationRole[] } },
    select: { id: true, email: true },
    take: 20,
  });
  return members.filter((m) => wants(m.id)).map((m) => m.email);
}

async function emailNotification(id: string) {
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.emailedAt) return;
  const to = await recipientsFor(n);
  if (!to.length) return;
  // Preferência: app da plataforma; sem ele, a conexão da própria loja (se pronta)
  const platform = await resolvePlatformResend();
  let apiKey = platform?.apiKey ?? null;
  let from = platform?.from ?? null;
  if (!apiKey || !from) {
    const conn = await resolveResend(n.clienteId);
    if (!resendReady(conn)) return;
    apiKey = conn.apiKey;
    from = formatFrom(conn, "Atrako");
  }
  const origin = getServerPublicOrigin();
  const link = n.href ? (n.href.startsWith("http") ? n.href : `${origin}${n.href}`) : `${origin}/notificacoes`;
  const color = n.severity === "urgente" ? "#b3261e" : "#1d1d1f";
  const html = `<!doctype html><html><body style="margin:0;background:#f5f5f7;font-family:-apple-system,Segoe UI,Helvetica,Arial,sans-serif">
<table role="presentation" width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:32px 16px">
<table role="presentation" width="560" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:12px">
<tr><td style="padding:28px 32px">
<p style="margin:0 0 8px;font-size:12px;letter-spacing:.04em;text-transform:uppercase;color:#6e6e73">Atrako · ${escape(n.severity)}</p>
<h1 style="margin:0 0 12px;font-size:21px;font-weight:600;color:${color}">${escape(n.title)}</h1>
${n.body ? `<p style="margin:0 0 20px;font-size:15px;line-height:1.5;color:#1d1d1f">${escape(n.body).replace(/\n/g, "<br>")}</p>` : ""}
<a href="${escape(link)}" style="display:inline-block;background:#0066cc;color:#ffffff;text-decoration:none;font-size:15px;padding:10px 18px;border-radius:5px">Abrir no Atrako</a>
</td></tr></table></td></tr></table></body></html>`;
  await sendResendEmail(
    apiKey,
    {
      from,
      to: to.slice(0, 50),
      subject: `${n.severity === "urgente" ? "[Urgente] " : ""}${n.title}`.slice(0, 200),
      html,
      text: `${n.title}\n\n${n.body ?? ""}\n\n${link}`,
      tags: [{ name: "kind", value: "team_notification" }],
    },
    `notif-${n.id}`,
  );
  await prisma.notification.update({ where: { id: n.id }, data: { emailedAt: new Date() } });
}

/** Visíveis para o leitor: diretas, do papel dele ou para todos. */
export function visibleWhere(clienteId: string, reader: { memberId: string | null; role: string | null }) {
  return {
    clienteId,
    OR: [
      { memberId: null, role: null },
      ...(reader.memberId ? [{ memberId: reader.memberId }] : []),
      ...(reader.role ? [{ memberId: null, role: reader.role }] : []),
      // Acesso de plataforma (equipe Atrako) vê os avisos de dono/admin
      ...(!reader.memberId ? [{ memberId: null, role: { in: ["OWNER", "ADMIN"] } }] : []),
    ],
  };
}

export function readerKey(reader: { memberId: string | null; internalId: string | null }) {
  return reader.memberId ?? (reader.internalId ? `internal:${reader.internalId}` : "anon");
}

export function isRead(n: { memberId: string | null; readAt: Date | null; readBy: string[] }, key: string) {
  return n.memberId ? Boolean(n.readAt) : n.readBy.includes(key);
}
