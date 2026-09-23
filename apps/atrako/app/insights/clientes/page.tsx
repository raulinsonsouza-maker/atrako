import { redirect } from "next/navigation";
import { getFirstActiveClienteId } from "@/lib/atrako/clientes-nav";

/** Página de listagem descontinuada. */
export default async function InsightsClientesRedirectPage() {
  const id = await getFirstActiveClienteId();
  if (!id) redirect("/config");
  redirect(`/clientes/${id}`);
}
