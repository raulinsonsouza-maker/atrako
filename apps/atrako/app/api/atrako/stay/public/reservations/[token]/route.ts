import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { publicReservationView } from "@/lib/stay/reservations";

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const row = await prisma.stayReservation.findUnique({
    where: { publicToken: token },
    include: { property: { select: { name: true, slug: true, published: true } } },
  });
  if (!row || !row.property.published) {
    return NextResponse.json({ error: "Reserva não encontrada" }, { status: 404 });
  }
  return NextResponse.json({
    propertyName: row.property.name,
    slug: row.property.slug,
    reservation: publicReservationView(row),
  });
}
