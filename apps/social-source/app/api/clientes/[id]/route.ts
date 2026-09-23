import { NextResponse } from "next/server";
import { findClienteById, findClienteBySlug } from "@/lib/repositories/clientesRepository";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const cliente = (await findClienteById(id)) ?? (await findClienteBySlug(id));
  if (!cliente) {
    return NextResponse.json({ error: "Cliente não encontrado" }, { status: 404 });
  }
  return NextResponse.json(cliente);
}
