import { BookingFunnel } from "@/components/booking/BookingFunnel";

export default async function PublicBookingPage({
  params,
  searchParams,
}: {
  params: Promise<{ slug: string; pageSlug: string }>;
  searchParams: Promise<{ resume?: string }>;
}) {
  const { slug: orgSlug, pageSlug } = await params;
  const { resume } = await searchParams;
  return (
    <BookingFunnel
      orgSlug={orgSlug}
      pageSlug={pageSlug}
      resumeToken={resume?.trim() || null}
    />
  );
}