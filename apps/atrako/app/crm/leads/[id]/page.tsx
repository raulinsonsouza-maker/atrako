import { redirect } from "next/navigation";

/** Detalhe do lead agora abre em modal no funil. */
export default async function CrmLeadDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/crm?lead=${encodeURIComponent(id)}`);
}
