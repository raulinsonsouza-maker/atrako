import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { BookingFunnel } from "@/components/booking/BookingFunnel";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { loadPublicBookingContext } from "@/lib/agenda/public-booking-helpers";

type Props = { params: Promise<{ workspaceSlug: string; pageSlug: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { workspaceSlug, pageSlug } = await params;
  const ctx = await loadPublicBookingContext(workspaceSlug, pageSlug);
  if (!ctx) return { title: "Agenda" };
  return {
    title: `${ctx.page.title} · ${ctx.page.workspaceName}`,
    description: ctx.page.description || undefined,
  };
}

export default async function PublicBookingFunnelPage({ params }: Props) {
  const { workspaceSlug, pageSlug } = await params;
  const ctx = await loadPublicBookingContext(workspaceSlug, pageSlug);
  if (!ctx) notFound();

  return (
    <BrandThemeScope primaryColor={ctx.page.accentColor} className="min-h-screen">
      <BookingFunnel
        workspaceSlug={workspaceSlug}
        pageSlug={pageSlug}
        initial={ctx}
      />
    </BrandThemeScope>
  );
}
