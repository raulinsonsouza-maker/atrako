import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { gate } from "@/lib/flows/api";
import { detectNativeRecovery } from "@/lib/flows/native-recovery";

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const [detections, conns] = await Promise.all([
    detectNativeRecovery(g.workspaceId),
    prisma.workspaceConnection.findMany({
      where: { clienteId: g.workspaceId, status: "ACTIVE", provider: { in: ["SHOPIFY", "NUVEMSHOP", "TRAY", "WOOCOMMERCE"] } },
      select: { provider: true },
    }),
  ]);
  return NextResponse.json({ detections, stores: conns.map((c) => c.provider.toLowerCase()) });
}
