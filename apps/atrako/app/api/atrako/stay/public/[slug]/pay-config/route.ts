import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";
import { resolvePlatformApp } from "@/lib/config/platformApps";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ slug: string }> },
) {
  const { slug } = await params;
  const property = await prisma.stayProperty.findUnique({ where: { slug } });
  if (!property || !property.published) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  if (!(await isPublicModuleEnabled(property.clienteId, "hospedagem"))) {
    return NextResponse.json({ error: "Imóvel indisponível" }, { status: 404 });
  }
  const [mp, google] = await Promise.all([
    resolveMercadoPago(property.clienteId),
    resolvePlatformApp("GOOGLE"),
  ]);
  return NextResponse.json({
    workspaceId: property.clienteId,
    mpConnected: Boolean(mp?.accessToken),
    publicKey: mp?.publicKey ?? null,
    googleEnabled: Boolean(google?.enabled && google.credentials.clientId),
  });
}
