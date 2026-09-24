import Link from "next/link";
import { redirect } from "next/navigation";
import { getInternalUser } from "@/lib/internalUsers";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";

export const dynamic = "force-dynamic";

/**
 * Landing pública “Em breve”. Sessão autenticada redireciona para a área certa.
 * LP completa virá depois; Entrar no canto superior direito.
 */
export default async function HomePage() {
  const [internal, member] = await Promise.all([getInternalUser(), getWorkspaceMember()]);

  if (internal && internal.id !== "atrako-open-access" && internal.active) {
    if (internal.mustChangePassword) redirect("/change-password");
    if (internal.role === "ADMIN") redirect("/admin/clientes");
    redirect("/assistente");
  }

  if (member) {
    redirect("/assistente");
  }

  return (
    <div className="relative flex min-h-dvh flex-col bg-[var(--canvas-parchment)]">
      <header className="absolute right-0 top-0 z-10 p-5 md:p-6">
        <Link
          href="/sign-in"
          className="inline-flex items-center justify-center rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-4 py-2 type-button-utility text-[var(--ink)] transition active:scale-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]"
        >
          Entrar
        </Link>
      </header>

      <main className="flex flex-1 flex-col items-center justify-center px-6 text-center">
        <p className="type-fine-print uppercase tracking-[0.2em] text-[var(--ink-muted-48)]">
          Atrako
        </p>
        <h1 className="type-tagline mt-3 max-w-lg text-[var(--ink)]">Em breve</h1>
        <p className="type-body mt-3 max-w-md text-[var(--ink-muted-48)]">
          Inteligência comercial para vender mais. A landing completa está a caminho.
        </p>
      </main>

      <footer className="pb-8 text-center type-fine-print text-[var(--ink-muted-48)]">
        © {new Date().getFullYear()} Atrako
      </footer>
    </div>
  );
}
