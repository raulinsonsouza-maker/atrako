import { NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { z } from "zod";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  mergeFunnelConfig,
  parseFunnelConfig,
  serializeFunnelConfig,
} from "@/lib/funnel-config";
import { funnelConfigSchema } from "@/types/funnel-config";

async function getOwnedPage(id: string, organizationId: string) {
  return prisma.bookingPage.findFirst({
    where: { id, organizationId },
  });
}

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const page = await getOwnedPage(id, session.user.organizationId);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const config = mergeFunnelConfig(parseFunnelConfig(page.funnelConfig), {
    title: page.title,
    description: page.description,
    accentColor: page.accentColor,
    logoUrl: page.logoUrl,
  });

  return NextResponse.json({
    slug: page.slug,
    config,
  });
}

export async function PUT(
  req: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.organizationId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id } = await params;
  const page = await getOwnedPage(id, session.user.organizationId);
  if (!page) return NextResponse.json({ error: "Not found" }, { status: 404 });

  try {
    const body = z.object({ config: funnelConfigSchema }).parse(await req.json());
    const config = body.config;

    await prisma.bookingPage.update({
      where: { id: page.id },
      data: {
        funnelConfig: serializeFunnelConfig(config),
        accentColor: config.theme.accentColor,
        logoUrl: config.theme.logoUrl || null,
        title: config.theme.heroTitle || page.title,
        description: config.theme.heroSubtitle ?? page.description,
      },
    });

    return NextResponse.json({ ok: true });
  } catch (e) {
    if (e instanceof z.ZodError) {
      return NextResponse.json({ error: "Config inv├ílida" }, { status: 400 });
    }
    return NextResponse.json({ error: "Erro" }, { status: 500 });
  }
}