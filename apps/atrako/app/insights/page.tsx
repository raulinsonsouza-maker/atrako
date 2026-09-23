import { redirect } from "next/navigation";
import Link from "next/link";
import { getFirstActiveClienteId } from "@/lib/atrako/clientes-nav";

/** Compat: /insights redireciona ao dashboard da primeira conta. */
export default async function InsightsIndexPage() {
  const id = await getFirstActiveClienteId();
  if (!id) {
    return (
      <main className="mx-auto max-w-lg px-4 py-16 text-center">
        <h1 className="type-tagline text-[var(--ink)]">Nenhuma conta</h1>
        <Link href="/config" className="mt-6 inline-block type-body text-[var(--primary)] underline">
          Criar empresa
        </Link>
      </main>
    );
  }
  redirect(`/clientes/${id}`);
}
