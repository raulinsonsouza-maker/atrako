import { NextRequest, NextResponse } from "next/server";
import { auth } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { userHasProductAccess } from "@/lib/entitlements";
import { serveProductFileById } from "@/lib/order-download";

export async function GET(req: NextRequest) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  const fileId = req.nextUrl.searchParams.get("fileId");
  if (!fileId) {
    return NextResponse.json({ error: "fileId obrigatório" }, { status: 400 });
  }

  const file = await prisma.productFile.findUnique({ where: { id: fileId } });
  if (!file) {
    return NextResponse.json({ error: "Arquivo não encontrado" }, { status: 404 });
  }

  const hasAccess = await userHasProductAccess(session.user.id, file.productId);
  if (!hasAccess) {
    return NextResponse.json({ error: "Sem acesso" }, { status: 403 });
  }

  return serveProductFileById(fileId);
}
