import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { getActiveIgAccountId } from "@/lib/symbius/activeIgAccount";

export async function GET() {
  const session = await requireApiSession();
  if (!isSession(session)) return session;

  const activeIg = await getActiveIgAccountId(session.organizationId);
  const contatos = await prisma.igContato.findMany({
    where: {
      organizationId: session.organizationId,
      ...(activeIg ? { igAccountId: activeIg } : {}),
    },
    orderBy: { lastInteractionAt: "desc" },
  });

  const header = "id,igsid,username,nome,phone,tags,lastInteractionAt\n";
  const lines = contatos.map((c) =>
    [
      c.id,
      c.igsid,
      c.username ?? "",
      c.nome ?? "",
      c.phone ?? "",
      c.tags.join("|"),
      c.lastInteractionAt?.toISOString() ?? "",
    ]
      .map((v) => `"${String(v).replace(/"/g, '""')}"`)
      .join(","),
  );

  return new NextResponse(header + lines.join("\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="contatos.csv"',
    },
  });
}

export async function POST(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const body = (await request.json()) as {
    rows: Array<{ igsid: string; username?: string; nome?: string; tags?: string }>;
    igAccountId: string;
  };

  const account = await prisma.igAccount.findFirst({
    where: { id: body.igAccountId, organizationId: session.organizationId },
  });
  if (!account) {
    return NextResponse.json({ error: "Conta IG inválida" }, { status: 400 });
  }

  let imported = 0;
  for (const row of body.rows ?? []) {
    if (!row.igsid) continue;
    await prisma.igContato.upsert({
      where: {
        igAccountId_igsid: { igAccountId: account.id, igsid: row.igsid },
      },
      create: {
        organizationId: session.organizationId,
        igAccountId: account.id,
        igsid: row.igsid,
        username: row.username,
        nome: row.nome,
        tags: row.tags ? row.tags.split("|").filter(Boolean) : [],
      },
      update: {
        username: row.username,
        nome: row.nome,
      },
    });
    imported++;
  }

  return NextResponse.json({ ok: true, imported });
}
