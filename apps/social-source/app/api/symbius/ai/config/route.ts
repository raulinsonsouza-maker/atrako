import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { isSession, requireApiSession } from "@/lib/symbius/apiHelpers";
import { getOrCreateOrgSettings } from "@/lib/symbius/integrations";

export async function GET() {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const settings = await getOrCreateOrgSettings(session.organizationId);
  return NextResponse.json({
    aiEnabled: settings.aiEnabled,
    aiKnowledgeBase: settings.aiKnowledgeBase,
    aiGoals: settings.aiGoals,
    aiTone: settings.aiTone,
    status: "backlog",
    message:
      "Configuração salva. Respostas IA serão ativadas na fase dedicada de IA.",
  });
}

const schema = z.object({
  aiEnabled: z.boolean().optional(),
  aiKnowledgeBase: z.string().optional().nullable(),
  aiGoals: z.record(z.unknown()).optional(),
  aiTone: z.string().optional().nullable(),
});

export async function PATCH(request: NextRequest) {
  const session = await requireApiSession("ADMIN");
  if (!isSession(session)) return session;

  const parsed = schema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados inválidos" }, { status: 400 });
  }

  const settings = await prisma.igOrgSettings.upsert({
    where: { organizationId: session.organizationId },
    create: {
      organizationId: session.organizationId,
      aiEnabled: parsed.data.aiEnabled ?? false,
      aiKnowledgeBase: parsed.data.aiKnowledgeBase ?? undefined,
      aiGoals: (parsed.data.aiGoals ?? {}) as object,
      aiTone: parsed.data.aiTone ?? undefined,
    },
    update: {
      aiEnabled: parsed.data.aiEnabled,
      aiKnowledgeBase: parsed.data.aiKnowledgeBase ?? undefined,
      aiGoals: parsed.data.aiGoals as object | undefined,
      aiTone: parsed.data.aiTone ?? undefined,
    },
  });

  return NextResponse.json({ ok: true, settings });
}
