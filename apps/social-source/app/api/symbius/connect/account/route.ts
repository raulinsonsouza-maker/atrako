import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

export async function PATCH(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const body = (await request.json()) as {
    accountId: string;
    status?: "CONNECTED" | "DISABLED";
  };

  if (!body.accountId) {
    return NextResponse.json({ error: "accountId obrigatório" }, { status: 400 });
  }

  const account = await prisma.igAccount.findFirst({
    where: {
      id: body.accountId,
      organizationId: session.organizationId,
    },
  });
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  const updated = await prisma.igAccount.update({
    where: { id: account.id },
    data: {
      status: body.status ?? account.status,
    },
  });

  return NextResponse.json({ account: updated });
}

export async function DELETE(request: NextRequest) {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const id = new URL(request.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id obrigatório" }, { status: 400 });
  }

  const account = await prisma.igAccount.findFirst({
    where: { id, organizationId: session.organizationId },
  });
  if (!account) {
    return NextResponse.json({ error: "Conta não encontrada" }, { status: 404 });
  }

  await prisma.igAccount.delete({ where: { id } });
  return NextResponse.json({ ok: true });
}
