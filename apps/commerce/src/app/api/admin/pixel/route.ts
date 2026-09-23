import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAdminApi } from "@/lib/admin-api";

export async function POST(request: Request) {
  const { error } = await requireAdminApi();
  if (error) return error;

  const body = await request.json();
  const pixelId =
    body.pixelId != null && String(body.pixelId).trim()
      ? String(body.pixelId).trim()
      : null;

  const existing = await prisma.pixelConfig.findUnique({ where: { id: "default" } });
  const capiToken =
    body.capiToken != null && String(body.capiToken).trim()
      ? String(body.capiToken).trim()
      : existing?.capiToken ?? null;

  const pixel = await prisma.pixelConfig.upsert({
    where: { id: "default" },
    update: {
      pixelId,
      ...(body.capiToken !== undefined ? { capiToken } : {}),
    },
    create: {
      id: "default",
      pixelId,
      capiToken,
    },
  });

  return NextResponse.json({
    id: pixel.id,
    pixelId: pixel.pixelId,
    hasToken: Boolean(pixel.capiToken),
  });
}
