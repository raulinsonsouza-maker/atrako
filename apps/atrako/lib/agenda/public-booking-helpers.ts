import { prisma } from "@/lib/db";
import { getAvailableDays } from "@/lib/agenda/availability";
import {
  buildDefaultFunnelConfig,
  parseFunnelConfig,
  type FunnelConfig,
} from "@/lib/agenda/funnel-config";
import {
  findPublicBookingPage,
  professionalsForService,
} from "@/lib/agenda/public-booking-page";
import { hasOnlinePayment } from "@/lib/agenda/payments";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";

export async function loadPublicBookingContext(workspaceSlug: string, pageSlug: string) {
  const page = await findPublicBookingPage(workspaceSlug, pageSlug);
  if (!page) return null;

  const settings = page.cliente.workspaceSettings;
  const businessMode: "SOLO" | "SALON" =
    settings?.businessMode === "SALON" ? "SALON" : "SOLO";
  const salonMode = businessMode === "SALON";
  const workspaceId = page.cliente.id;

  const accentColor =
    page.accentColor ||
    settings?.primaryColor ||
    "#0066cc";

  const rawFunnel = parseFunnelConfig(page.funnelConfig);
  const funnelConfig: FunnelConfig = rawFunnel
    ? {
        ...rawFunnel,
        theme: {
          ...buildDefaultFunnelConfig({
            title: page.title,
            description: page.description,
            accentColor,
            logoUrl: page.logoUrl || page.cliente.logoUrl,
          }).theme,
          ...rawFunnel.theme,
          accentColor,
          logoUrl: rawFunnel.theme?.logoUrl || page.logoUrl || page.cliente.logoUrl || undefined,
          heroTitle: rawFunnel.theme?.heroTitle || page.title,
          heroSubtitle: rawFunnel.theme?.heroSubtitle || page.description || undefined,
        },
      }
    : buildDefaultFunnelConfig({
        title: page.title,
        description: page.description,
        accentColor,
        logoUrl: page.logoUrl || page.cliente.logoUrl,
      });

  const services = page.pageServices
    .map((ps) => {
      const s = ps.service;
      const pros = professionalsForService(s);
      const intakeSlug = s.intakeProduct?.checkoutLinks?.[0]?.slug ?? null;
      return {
        id: s.id,
        title: s.title,
        description: s.description,
        imageUrl: s.imageUrl,
        durationMinutes: s.durationMinutes,
        priceCents: intakeSlug
          ? (s.intakeProduct?.priceCents ?? s.priceCents)
          : s.priceCents,
        bufferBefore: s.bufferBefore,
        bufferAfter: s.bufferAfter,
        customFields: s.customFields.map((f) => ({
          id: f.id,
          label: f.label,
          type: f.type,
          required: f.required,
          options: f.options,
        })),
        professionals: pros.map((p) => ({
          id: p.id,
          displayName: p.displayName,
          photoUrl: p.photoUrl,
        })),
        isIntake: Boolean(intakeSlug),
        intakeCheckoutSlug: intakeSlug,
      };
    })
    .filter((s) => !salonMode || s.isIntake || (s.professionals?.length ?? 0) > 0);

  const [onlinePayment, mercadoPagoPublicKey, availableDays] = await Promise.all([
    hasOnlinePayment(workspaceId),
    getMpPublicKey(workspaceId),
    getAvailableDays({
      bookingPageId: page.id,
      from: new Date(),
      timezone: page.timezone,
      professionalId: null,
    }),
  ]);

  return {
    page: {
      id: page.id,
      title: page.title,
      slug: page.slug,
      workspaceSlug: page.cliente.slug,
      workspaceName: page.cliente.nome,
      description: page.description,
      logoUrl: page.logoUrl || page.cliente.logoUrl,
      coverImageUrl: page.coverImageUrl,
      accentColor,
      websiteUrl: page.websiteUrl,
      instagram: page.instagram,
      timezone: page.timezone,
    },
    funnelConfig,
    businessMode,
    services,
    availableDays,
    currency: settings?.currency || "BRL",
    onlinePayment,
    mercadoPagoPublicKey,
    tracking: settings?.tracking ?? {},
  };
}

export async function resolveServiceOnPage(
  workspaceSlug: string,
  pageSlug: string,
  serviceId: string,
) {
  const page = await findPublicBookingPage(workspaceSlug, pageSlug);
  if (!page) return null;
  const link = page.pageServices.find((ps) => ps.serviceId === serviceId);
  if (!link) return null;
  return { page, service: link.service };
}
