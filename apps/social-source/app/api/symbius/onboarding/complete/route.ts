import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { getSession } from "@/lib/symbius/auth";

export async function POST() {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }

  await prisma.organization.update({
    where: { id: session.organizationId },
    data: { onboardingDone: true },
  });

  return NextResponse.json({ ok: true });
}
