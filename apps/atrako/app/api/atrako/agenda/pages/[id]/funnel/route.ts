import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import type { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { requireWorkspace, jsonError } from "@/lib/agenda/api";
import {
  mergeFunnelConfig,
  parseFunnelConfig,
  serializeFunnelConfig,
} from "@/lib/agenda/funnel-config";
import { funnelConfigSchema } from "@/lib/agenda/funnel-config-types";

async function getOwnedPage(id: string, clienteId: string) {
  return prisma.agendaBookingPage.findFirst({ where: { id, clienteId } });
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const ws = await requireWorkspace(request.nextUrl.searchParams.get("workspaceId"));
  if ("error" in ws) return ws.error;
  const { id } = await params;

  const page = await getOwnedPage(id, ws.workspaceId);
  if (!page) return jsonError("Não encontrado", 404);

  const config = mergeFunnelConfig(parseFunnelConfig(page.funnelConfig), {
    title: page.title,
    description: page.description,
    accentColor: page.accentColor,
    logoUrl: page.logoUrl,
  });

  return NextResponse.json({ slug: page.slug, config });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    return jsonError("JSON inválido");
  }

  try {
    const body = z
      .object({
        workspaceId: z.string().min(1),
        config: funnelConfigSchema,
      })
      .parse(raw);
    const ws = await requireWorkspace(body.workspaceId);
    if ("error" in ws) return ws.error;

    const page = await getOwnedPage(id, ws.workspaceId);
    if (!page) return jsonError("Não encontrado", 404);

    const config = body.config;

    await prisma.agendaBookingPage.update({
      where: { id: page.id },
      data: {
        funnelConfig: serializeFunnelConfig(config) as Prisma.InputJsonValue,
        accentColor: config.theme.accentColor,
        logoUrl: config.theme.logoUrl || null,
        title: config.theme.heroTitle || page.title,
        description: config.theme.heroSubtitle ?? page.description,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) return jsonError("Config inválida");
    return jsonError("Erro", 500);
  }
}
