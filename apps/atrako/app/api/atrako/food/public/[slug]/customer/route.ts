import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { asFoodAddresses, contactFromFoodSession, rememberFoodAddress, sendFoodCode, verifyFoodCode } from "@/lib/food/customer";

const COOKIE = "food_customer";

async function storeOf(slug: string) {
  const store = await prisma.foodStore.findUnique({ where: { slug }, select: { clienteId: true, status: true } });
  if (!store || store.status === "DISABLED" || !(await isPublicModuleEnabled(store.clienteId, "food"))) return null;
  return store;
}

function sessionCookie(contactId: string, token: string) {
  return `${contactId}.${token}`;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await storeOf(slug);
  if (!store) return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  const contact = await contactFromFoodSession(store.clienteId, request.cookies.get(COOKIE)?.value);
  if (!contact) return NextResponse.json({ addresses: [] });
  return NextResponse.json({ addresses: asFoodAddresses((contact.metadata as { foodAddresses?: unknown } | null)?.foodAddresses) });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const store = await storeOf(slug);
  if (!store) return NextResponse.json({ error: "Loja indisponível" }, { status: 404 });
  const body = (await request.json().catch(() => ({}))) as Record<string, unknown>;
  const action = typeof body.action === "string" ? body.action : "";
  if (action === "send") {
    const sent = await sendFoodCode({
      workspaceId: store.clienteId,
      phone: typeof body.phone === "string" ? body.phone : "",
      name: typeof body.name === "string" ? body.name : "",
    });
    if (!sent.ok) return NextResponse.json({ error: sent.error }, { status: 400 });
    return NextResponse.json({ sent: sent.sent });
  }
  if (action === "verify") {
    const verified = await verifyFoodCode({
      workspaceId: store.clienteId,
      phone: typeof body.phone === "string" ? body.phone : "",
      code: typeof body.code === "string" ? body.code : "",
    });
    if (!verified.ok) return NextResponse.json({ error: verified.error }, { status: 400 });
    const address = body.address && typeof body.address === "object" ? (body.address as Record<string, unknown>) : null;
    const lat = address?.lat;
    const lng = address?.lng;
    if (typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng)) {
      await rememberFoodAddress(verified.contactId, {
        cep: typeof address.cep === "string" ? address.cep : "",
        street: typeof address.street === "string" ? address.street : "",
        number: typeof address.number === "string" ? address.number : "",
        complement: typeof address.complement === "string" ? address.complement : "",
        neighborhood: typeof address.neighborhood === "string" ? address.neighborhood : "",
        lat,
        lng,
      });
    }
    const response = NextResponse.json({ ok: true });
    response.cookies.set(COOKIE, sessionCookie(verified.contactId, verified.token), {
      httpOnly: true,
      sameSite: "lax",
      path: "/",
      maxAge: 180 * 24 * 60 * 60,
    });
    return response;
  }
  return NextResponse.json({ error: "Ação inválida" }, { status: 400 });
}
