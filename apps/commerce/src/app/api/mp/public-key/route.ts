import { NextResponse } from "next/server";
import { getConnectedMpAccount } from "@/lib/mercadopago/client";
import { fetchMercadoPagoFromAtrako } from "@/lib/atrako-connections";

export async function GET() {
  const hub = await fetchMercadoPagoFromAtrako();
  if (hub?.accessToken) {
    return NextResponse.json({
      connected: true,
      publicKey: hub.publicKey || process.env.NEXT_PUBLIC_MP_PUBLIC_KEY || null,
      liveMode: hub.liveMode ?? true,
      source: "atrako",
    });
  }

  const account = await getConnectedMpAccount();
  if (!account) {
    return NextResponse.json({ connected: false }, { status: 404 });
  }
  return NextResponse.json({
    connected: true,
    publicKey: account.publicKey,
    liveMode: account.liveMode,
    source: "local",
  });
}
