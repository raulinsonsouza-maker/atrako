import { NextRequest, NextResponse } from "next/server";
import { establishPortalSession, setPortalSessionCookie } from "@/lib/portalSession";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;
  const session = await establishPortalSession(token);
  if (!session) {
    return NextResponse.json({ error: "Token não encontrado" }, { status: 404 });
  }
  return setPortalSessionCookie(
    NextResponse.json({ clienteId: session.cliente.id, nome: session.cliente.nome }),
    session.cookie.value,
  );
}
