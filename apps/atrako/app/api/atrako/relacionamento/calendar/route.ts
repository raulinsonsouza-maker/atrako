import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { bad, gate, readBody, str } from "@/lib/flows/api";
import { retailCalendar, upcomingDates, upsertCalendarDate } from "@/lib/flows/calendar";

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const year = new Date().getUTCFullYear();
  const [prefs, upcoming] = await Promise.all([
    prisma.workspaceCalendarDate.findMany({ where: { clienteId: ws } }),
    upcomingDates(ws, { days: Number(request.nextUrl.searchParams.get("days")) || 120 }),
  ]);
  const byKey = new Map(prefs.map((p) => [p.key, p]));
  return NextResponse.json({
    seasonal: retailCalendar(year).map((d) => ({
      key: d.key,
      label: d.label,
      date: d.date.toISOString(),
      hint: d.hint ?? null,
      enabled: byKey.get(d.key)?.enabled ?? true,
      leadDays: byKey.get(d.key)?.leadDays ?? 30,
    })),
    custom: prefs
      .filter((p) => p.custom)
      .map((p) => ({
        key: p.key,
        label: p.label,
        date: p.date?.toISOString() ?? null,
        recurring: p.recurring,
        enabled: p.enabled,
        leadDays: p.leadDays,
      })),
    upcoming: upcoming.map((d) => ({ ...d, date: d.date.toISOString() })),
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const g = await gate(request, "manage", body);
  if (!g.ok) return g.response;
  if (body.action === "delete") {
    const key = str(body.key);
    if (!key.startsWith("custom:")) return bad("Só datas próprias podem ser excluídas — desative as sazonais");
    await prisma.workspaceCalendarDate.deleteMany({ where: { clienteId: g.workspaceId, key } });
    return NextResponse.json({ ok: true });
  }
  const key = str(body.key) || undefined;
  const label = str(body.label) || undefined;
  if (!key && !label) return bad("Informe o nome da data");
  if (!key && !str(body.date)) return bad("Informe a data");
  const row = await upsertCalendarDate(g.workspaceId, {
    key,
    label,
    date: body.date === undefined ? undefined : str(body.date) || null,
    recurring: typeof body.recurring === "boolean" ? body.recurring : undefined,
    enabled: typeof body.enabled === "boolean" ? body.enabled : undefined,
    leadDays: body.leadDays != null ? Number(body.leadDays) : undefined,
  });
  return NextResponse.json({ ok: true, key: row.key });
}
