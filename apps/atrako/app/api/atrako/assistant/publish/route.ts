import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import { resolveAssistantSession } from "@/lib/atrako-agent/session";
import { formPreviewArtifact, lpPreviewArtifact, publishResource } from "@/lib/atrako-agent/creator";
import { getCaptureFormById } from "@/lib/modules/capture-form";
import type { Artifact } from "@/lib/atrako-agent/artifacts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Botão "Publicar" do card de prévia: publica e atualiza o artefato salvo na mensagem. */
export async function POST(request: NextRequest) {
  const s = await resolveAssistantSession();
  if (!s.ok) return s.response;
  const { workspaceId, actor } = s.session;
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const conversationId = typeof body?.conversationId === "string" ? body.conversationId : "";
  const messageId = typeof body?.messageId === "string" ? body.messageId : "";
  const artifactId = typeof body?.artifactId === "string" ? body.artifactId : "";

  const message = await prisma.atrakoMessage.findFirst({
    where: {
      id: messageId,
      role: "ASSISTANT",
      conversation: { id: conversationId, clienteId: workspaceId, actorKey: actor.key },
    },
    select: { id: true, toolContext: true },
  });
  const tc = (message?.toolContext ?? {}) as { artifacts?: Artifact[] } & Record<string, unknown>;
  const target = tc.artifacts?.find((a) => a.id === artifactId);
  if (!message || !target || (target.kind !== "lp_preview" && target.kind !== "form_preview")) {
    return NextResponse.json({ error: "Prévia não encontrada" }, { status: 404 });
  }

  try {
    let next: Artifact;
    if (target.kind === "lp_preview") {
      const result = await publishResource(workspaceId, "landing_page", target.productId);
      const p = await prisma.commerceProduct.findFirst({
        where: { id: result.id, clienteId: workspaceId },
        select: { id: true, clienteId: true, name: true, slug: true, status: true, salesPage: true },
      });
      next = p ? { ...lpPreviewArtifact(p), id: target.id } : { ...target, status: "PUBLISHED" };
    } else {
      await publishResource(workspaceId, "form", target.formId);
      const f = await getCaptureFormById(workspaceId, target.formId);
      next = f ? { ...formPreviewArtifact(f), id: target.id } : { ...target, status: "PUBLISHED" };
    }
    await prisma.atrakoMessage.update({
      where: { id: message.id },
      data: {
        toolContext: {
          ...tc,
          artifacts: (tc.artifacts ?? []).map((a) => (a.id === target.id ? next : a)),
        } as unknown as Prisma.InputJsonValue,
      },
    });
    return NextResponse.json({ artifact: next });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Não foi possível publicar." }, { status: 400 });
  }
}
