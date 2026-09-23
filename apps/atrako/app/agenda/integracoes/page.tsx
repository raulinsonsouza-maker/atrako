import { redirect } from "next/navigation";

export default async function AgendaIntegracoesRedirect({
  searchParams,
}: {
  searchParams: Promise<{ workspaceId?: string }>;
}) {
  const sp = await searchParams;
  const q = sp.workspaceId
    ? `?workspaceId=${encodeURIComponent(sp.workspaceId)}`
    : "";
  redirect(`/config/conexoes${q}`);
}
