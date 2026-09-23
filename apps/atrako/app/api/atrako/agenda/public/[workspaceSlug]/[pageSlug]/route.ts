import { NextResponse } from "next/server";
import {
  findPublicBookingPage,
  professionalsForService,
} from "@/lib/agenda/public-booking-page";
import {
  buildDefaultFunnelConfig,
  parseFunnelConfig,
} from "@/lib/agenda/funnel-config";

type Ctx = {
  params: Promise<{ workspaceSlug: string; pageSlug: string }>;
};

export async function GET(_req: Request, { params }: Ctx) {
  const { workspaceSlug, pageSlug } = await params;
  const page = await findPublicBookingPage(workspaceSlug, pageSlug);
  if (!page) {
    return NextResponse.json({ error: "Não encontrado" }, { status: 404 });
  }

  const settings = page.cliente.workspaceSettings;
  const funnel =
    parseFunnelConfig(page.funnelConfig) ||
    buildDefaultFunnelConfig({
      title: page.title,
      description: page.description,
      accentColor: page.accentColor || settings?.primaryColor,
      logoUrl: page.logoUrl || page.cliente.logoUrl,
    });

  const services = page.pageServices
    .map((ps) => ps.service)
    .filter((s) => s.active)
    .map((s) => ({
      id: s.id,
      title: s.title,
      description: s.description,
      imageUrl: s.imageUrl,
      durationMinutes: s.durationMinutes,
      priceCents: s.priceCents,
      customFields: s.customFields,
      professionals: professionalsForService(s),
      intakeCheckoutSlug: s.intakeProduct?.checkoutLinks?.[0]?.slug ?? null,
    }));

  return NextResponse.json({
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      description: page.description,
      timezone: page.timezone || settings?.timezone || "America/Sao_Paulo",
      accentColor:
        page.accentColor || settings?.primaryColor || "#0066cc",
      logoUrl: page.logoUrl || page.cliente.logoUrl,
      coverImageUrl: page.coverImageUrl,
    },
    workspace: {
      id: page.cliente.id,
      name: page.cliente.nome,
      slug: page.cliente.slug,
      businessMode: settings?.businessMode || "SOLO",
      currency: settings?.currency || "BRL",
    },
    funnel,
    services,
  });
}
