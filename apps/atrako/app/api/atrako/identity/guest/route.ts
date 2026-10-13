import { NextRequest, NextResponse } from "next/server";
import { cookies } from "next/headers";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { saveGuestProfile } from "@/lib/identity/guest";
import { GUEST_COOKIE, guestCookieOptions, readGuest, signGuest } from "@/lib/identity/guest-session";

export async function GET(request: NextRequest) {
  const clienteId = request.nextUrl.searchParams.get("clienteId")?.trim() || "";
  const jar = await cookies();
  const guest = readGuest(jar.get(GUEST_COOKIE)?.value);
  if (!guest || (clienteId && guest.clienteId !== clienteId)) {
    return NextResponse.json({ guest: null });
  }
  return NextResponse.json({ guest });
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const clienteId = typeof body.clienteId === "string" ? body.clienteId.trim() : "";
  if (!clienteId || !(await findWorkspaceById(clienteId))) {
    return NextResponse.json({ error: "Workspace inválido." }, { status: 400 });
  }
  try {
    const guest = await saveGuestProfile({
      workspaceId: clienteId,
      firstName: typeof body.firstName === "string" ? body.firstName : null,
      lastName: typeof body.lastName === "string" ? body.lastName : null,
      name: typeof body.name === "string" ? body.name : null,
      email: typeof body.email === "string" ? body.email : null,
      phone: typeof body.phone === "string" ? body.phone : null,
      birthDate: typeof body.birthDate === "string" ? body.birthDate : null,
      cpf: typeof body.cpf === "string" ? body.cpf : null,
      promoOptOut: Boolean(body.promoOptOut),
      source: typeof body.source === "string" ? body.source : "guest",
    });
    const response = NextResponse.json({ guest });
    response.cookies.set(GUEST_COOKIE, signGuest(guest), guestCookieOptions());
    return response;
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Não foi possível salvar o cadastro." },
      { status: 400 },
    );
  }
}
