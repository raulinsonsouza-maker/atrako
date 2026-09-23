import { NextRequest, NextResponse } from "next/server";
import { getApprovedOrderFiles, serveProductFileById } from "@/lib/order-download";

/**
 * Download pós-compra sem login: orderId aprovado + fileId do produto comprado.
 * O orderId (cuid) funciona como token de acesso curto à entrega.
 */
export async function GET(req: NextRequest) {
  const orderId = req.nextUrl.searchParams.get("orderId");
  const fileId = req.nextUrl.searchParams.get("fileId");

  if (!orderId) {
    return NextResponse.json({ error: "orderId obrigatório" }, { status: 400 });
  }

  const files = await getApprovedOrderFiles(orderId);
  if (!files) {
    return NextResponse.json({ error: "Pedido não encontrado ou ainda não aprovado" }, { status: 403 });
  }

  if (files.length === 0) {
    return NextResponse.json({ error: "Nenhum arquivo disponível" }, { status: 404 });
  }

  const targetId = fileId || files[0].id;
  if (!files.some((f) => f.id === targetId)) {
    return NextResponse.json({ error: "Arquivo não pertence a este pedido" }, { status: 403 });
  }

  return serveProductFileById(targetId);
}
