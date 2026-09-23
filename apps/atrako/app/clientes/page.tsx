import { redirect } from "next/navigation";
import { getFirstActiveClienteId } from "@/lib/atrako/clientes-nav";

export const dynamic = "force-dynamic";

export default async function ClientesLegacyRedirect() {
  const id = await getFirstActiveClienteId();
  if (!id) redirect("/config");
  redirect(`/clientes/${id}`);
}
