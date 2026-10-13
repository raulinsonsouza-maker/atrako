import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { publicProperty } from "@/lib/stay/catalog";
import { addDays, occupiedNights, todayInTimeZone } from "@/lib/stay/nights";

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
  const today = todayInTimeZone(property.timezone);
  const horizon = addDays(today, 240);
  const [reservations, blocks] = await Promise.all([
    prisma.stayReservation.findMany({
      where: { propertyId: property.id, status: { in: ["CONFIRMED", "PENDING_PAYMENT"] }, checkOut: { gt: today } },
      select: { checkIn: true, checkOut: true, status: true, holdExpiresAt: true },
    }),
    prisma.stayBlock.findMany({
      where: { propertyId: property.id, endDate: { gt: today } },
      select: { startDate: true, endDate: true },
    }),
  ]);
  const occupied = [...occupiedNights({ reservations, blocks })].filter((day) => day >= today && day < horizon);
  return NextResponse.json({
    property: publicProperty(property),
    workspaceId: property.clienteId,
    today,
    occupied,
  });
}
