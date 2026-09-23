import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import { provisionOrganization } from "@/lib/onboarding";
import { createTrialSubscription } from "@/lib/billing/platform";

const schema = z.object({
  organizationName: z.string().min(2),
});

export async function POST(req: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
    }

    const body = await req.json();
    const { organizationName } = schema.parse(body);

    const existing = await prisma.membership.findFirst({
      where: { userId: session.user.id },
    });
    if (existing) {
      return NextResponse.json(
        { error: "Empresa já configurada" },
        { status: 400 },
      );
    }

    const result = await provisionOrganization(
      session.user.id,
      organizationName,
    );

    await createTrialSubscription(result.organizationId);

    return NextResponse.json({ ok: true, ...result });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
    }
    console.error(e);
    return NextResponse.json({ error: "Erro ao concluir cadastro" }, { status: 500 });
  }
}
