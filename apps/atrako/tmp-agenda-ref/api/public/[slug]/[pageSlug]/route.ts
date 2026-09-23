import { NextResponse } from "next/server";
import {
  getAvailableDays,
  getAvailableDaysAnyone,
  getAvailableSlots,
  getAvailableSlotsAnyone,
} from "@/lib/availability";
import { mergeFunnelConfig, parseFunnelConfig } from "@/lib/funnel-config";
import { resolvePaymentProvider, paymentProviderLabel } from "@/lib/payments/resolve-provider";
import { resolveBrand } from "@/lib/branding";
import {
  findPublicBookingPage,
  professionalsForService,
} from "@/lib/public-booking-page";

function mapServicePayload(
  s: {
    id: string;
    title: string;
    description: string | null;
    imageUrl: string | null;
    durationMinutes: number;
    priceCents: number;
    customFields: unknown;
    intakeProductId: string | null;
    intakeProduct?: {
      priceCents: number;
      checkoutLinks: { slug: string }[];
    } | null;
  },
  professionals?: { id: string; displayName: string; photoUrl: string | null }[],
) {
  const intakeSlug = s.intakeProduct?.checkoutLinks[0]?.slug ?? null;
  return {
    id: s.id,
    title: s.title,
    description: s.description,
    imageUrl: s.imageUrl,
    durationMinutes: s.durationMinutes,
    priceCents: intakeSlug ? (s.intakeProduct?.priceCents ?? s.priceCents) : s.priceCents,
    customFields: s.customFields,
    intakeProductId: s.intakeProductId,
    intakeCheckoutSlug: intakeSlug,
    isIntake: Boolean(intakeSlug),
    ...(professionals ? { professionals } : {}),
  };
}

export async function GET(
  req: Request,
  { params }: { params: Promise<{ slug: string; pageSlug: string }> },
) {
  const { slug: orgSlug, pageSlug } = await params;
  const { searchParams } = new URL(req.url);
  const date = searchParams.get("date");
  const serviceId = searchParams.get("serviceId");
  const professionalId = searchParams.get("professionalId");
  const anyone = searchParams.get("anyone") === "1";

  const page = await findPublicBookingPage(orgSlug, pageSlug);

  if (!page) {
    return NextResponse.json({ error: "P├ígina n├úo encontrada" }, { status: 404 });
  }

  const salonMode = page.organization.businessMode === "SALON";

  if (!date) {
    const provider = resolvePaymentProvider(page.organization);
    const brand = resolveBrand({
      org: page.organization,
      title: page.title,
      description: page.description,
      logoUrl: page.logoUrl,
      accentColor: page.accentColor,
    });
    const mergedFunnel = mergeFunnelConfig(parseFunnelConfig(page.funnelConfig), {
      title: brand.title,
      description: brand.description,
      accentColor: brand.accentColor,
      logoUrl: brand.logoUrl,
    });

    // Em SALON, s├│ servi├ºos com pelo menos um profissional vinculado
    const services = salonMode
      ? page.services
          .map((s) => {
            const pros = professionalsForService(s);
            return mapServicePayload(
              s,
              pros.map((p) => ({
                id: p.id,
                displayName: p.displayName,
                photoUrl: p.photoUrl,
              })),
            );
          })
          .filter((s) => s.isIntake || (s.professionals?.length ?? 0) > 0)
      : page.services.map((s) => mapServicePayload(s));

    const days = await getAvailableDays({
      bookingPageId: page.id,
      from: new Date(),
      timezone: page.timezone,
      // dias gerais: SOLO usa p├ígina; SALON sem pro ainda n├úo ÔÇö dias por pro no passo seguinte
      professionalId: null,
    });

    return NextResponse.json({
      page: {
        id: page.id,
        title: brand.title,
        slug: page.slug,
        orgSlug: page.organization.slug,
        description: brand.description,
        logoUrl: brand.logoUrl,
        coverImageUrl: page.coverImageUrl,
        accentColor: brand.accentColor,
        websiteUrl: page.websiteUrl,
        instagram: page.instagram,
        timezone: page.timezone,
      },
      brand: {
        businessName: brand.businessName,
        logoUrl: brand.logoUrl,
        accentColor: brand.accentColor,
        description: brand.description,
      },
      funnelConfig: {
        ...mergedFunnel,
        theme: {
          ...mergedFunnel.theme,
          logoUrl: mergedFunnel.theme.logoUrl || brand.logoUrl || undefined,
          accentColor: brand.accentColor,
          heroSubtitle:
            mergedFunnel.theme.heroSubtitle || brand.description || undefined,
        },
      },
      businessMode: page.organization.businessMode,
      services,
      availableDays: days,
      paymentProvider: provider,
      paymentProviderLabel: paymentProviderLabel(provider),
      caktoSdkClientId: page.organization.caktoSdkClientId || null,
      mercadoPagoPublicKey: page.organization.mercadoPagoPublicKey || null,
      cardMaxInstallments: Math.min(
        12,
        Math.max(1, page.organization.cardMaxInstallments || 12),
      ),
      demoPayments: provider === "DEMO",
      tracking: {
        metaPixelId: page.organization.metaPixelId || null,
        googleAdsSendTo: page.organization.googleAdsSendTo || null,
      },
    });
  }

  if (!serviceId) {
    return NextResponse.json({ error: "serviceId obrigat├│rio" }, { status: 400 });
  }

  const service = page.services.find((s) => s.id === serviceId);
  if (!service) {
    return NextResponse.json({ error: "Servi├ºo n├úo encontrado" }, { status: 404 });
  }

  if (salonMode) {
    const pros = professionalsForService(service);
    if (pros.length === 0) {
      return NextResponse.json({ slots: [], timezone: page.timezone });
    }

    if (anyone) {
      const [slots, days] = await Promise.all([
        getAvailableSlotsAnyone({
          bookingPageId: page.id,
          serviceId: service.id,
          date,
          timezone: page.timezone,
          durationMinutes: service.durationMinutes,
          bufferBefore: service.bufferBefore,
          bufferAfter: service.bufferAfter,
          professionalIds: pros.map((p) => p.id),
        }),
        getAvailableDaysAnyone({
          bookingPageId: page.id,
          from: new Date(),
          timezone: page.timezone,
          professionalIds: pros.map((p) => p.id),
        }),
      ]);
      return NextResponse.json({
        slots,
        availableDays: days,
        timezone: page.timezone,
        anyone: true,
      });
    }

    if (!professionalId || !pros.some((p) => p.id === professionalId)) {
      return NextResponse.json({ error: "professionalId obrigat├│rio" }, { status: 400 });
    }

    const [slots, days] = await Promise.all([
      getAvailableSlots({
        bookingPageId: page.id,
        serviceId: service.id,
        date,
        timezone: page.timezone,
        durationMinutes: service.durationMinutes,
        bufferBefore: service.bufferBefore,
        bufferAfter: service.bufferAfter,
        professionalId,
      }),
      getAvailableDays({
        bookingPageId: page.id,
        from: new Date(),
        timezone: page.timezone,
        professionalId,
      }),
    ]);

    return NextResponse.json({ slots, availableDays: days, timezone: page.timezone });
  }

  const slots = await getAvailableSlots({
    bookingPageId: page.id,
    serviceId: service.id,
    date,
    timezone: page.timezone,
    durationMinutes: service.durationMinutes,
    bufferBefore: service.bufferBefore,
    bufferAfter: service.bufferAfter,
  });

  return NextResponse.json({ slots, timezone: page.timezone });
}