import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isRead, memberNotifyPrefs, visibleWhere } from "@/lib/notifications";
import { flowActor, gate, readBody, bad } from "@/lib/flows/api";

/** Lista + contagem de não lidas (sino e /notificacoes). */
export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const actor = await flowActor(g.workspaceId);
  const where = visibleWhere(g.workspaceId, { memberId: actor.memberId, role: actor.role });
  const sp = request.nextUrl.searchParams;
  const limit = Math.min(100, Math.max(1, Number(sp.get("limit")) || 30));
  const onlyUnread = sp.get("unread") === "1";
  const rows = await prisma.notification.findMany({
    where,
    orderBy: { createdAt: "desc" },
    take: onlyUnread ? 200 : limit,
  });
  const recent = await prisma.notification.findMany({
    where: { ...where, createdAt: { gte: new Date(Date.now() - 60 * 86_400_000) } },
    select: { memberId: true, readAt: true, readBy: true },
    take: 500,
  });
  const unread = recent.filter((n) => !isRead(n, actor.readerKey)).length;
  const prefs = actor.memberId ? (await memberNotifyPrefs(g.workspaceId))[actor.memberId] : undefined;
  const items = rows
    .map((n) => ({
      id: n.id,
      type: n.type,
      title: n.title,
      body: n.body,
      href: n.href,
      severity: n.severity,
      createdAt: n.createdAt.toISOString(),
      read: isRead(n, actor.readerKey),
    }))
    .filter((n) => !onlyUnread || !n.read)
    .slice(0, limit);
  return NextResponse.json({
    items,
    unread,
    prefs: actor.memberId ? (prefs ?? { email: true, urgentOnly: false }) : null,
  });
}

/** Marcar como lida: `{ ids: [...] }` ou `{ all: true }`. */
export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "operate", body);
  if (!g.ok) return g.response;
  const actor = await flowActor(g.workspaceId);

  if (body.action === "prefs") {
    if (!actor.memberId) return bad("Preferências valem para membros do workspace");
    const s = await prisma.workspaceSettings.findUnique({ where: { clienteId: g.workspaceId }, select: { notifyPrefs: true } });
    const np = (s?.notifyPrefs ?? {}) as Record<string, unknown>;
    const members = { ...((np.members ?? {}) as Record<string, unknown>) };
    members[actor.memberId] = { email: body.email !== false, urgentOnly: body.urgentOnly === true };
    await prisma.workspaceSettings.update({
      where: { clienteId: g.workspaceId },
      data: { notifyPrefs: JSON.parse(JSON.stringify({ ...np, members })) },
    });
    return NextResponse.json({ ok: true });
  }

  const where = visibleWhere(g.workspaceId, { memberId: actor.memberId, role: actor.role });
  const ids = Array.isArray(body.ids) ? body.ids.filter((x): x is string => typeof x === "string").slice(0, 200) : [];
  const rows = await prisma.notification.findMany({
    where: body.all ? where : { AND: [where, { id: { in: ids } }] },
    select: { id: true, memberId: true, readAt: true, readBy: true },
    take: 500,
  });
  const now = new Date();
  let marked = 0;
  for (const n of rows) {
    if (isRead(n, actor.readerKey)) continue;
    if (n.memberId) {
      await prisma.notification.update({ where: { id: n.id }, data: { readAt: now } });
    } else {
      await prisma.notification.update({ where: { id: n.id }, data: { readBy: { push: actor.readerKey } } });
    }
    marked++;
  }
  return NextResponse.json({ ok: true, marked });
}
