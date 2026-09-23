import "../symbius.css";
import { getSession } from "@/lib/symbius/auth";
import { getSymbiusShellData } from "@/lib/symbius/shellData";
import { SymbiusAppShell } from "@/components/symbius/SymbiusAppShell";

/**
 * Social nativo no Atrako — mesmo processo, sem iframe.
 * Sessão: embed automático (workspace Atrako).
 */
export default async function SocialLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session) {
    return (
      <div className="p-6 text-sm text-red-600">
        Não foi possível iniciar a sessão do Social. Verifique SOCIAL_DATABASE_URL.
      </div>
    );
  }

  const shell = await getSymbiusShellData(session);
  return <SymbiusAppShell shell={shell}>{children}</SymbiusAppShell>;
}
