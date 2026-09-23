import { PageHeader } from "@/components/ui/PageHeader";
import { Panel } from "@/components/ui/Panel";
import { requireBuyer } from "@/lib/session";
import { PasswordForm } from "./PasswordForm";

export default async function ContaPage() {
  const session = await requireBuyer();

  return (
    <div className="stack">
      <PageHeader title="Minha conta" description="Gerencie seu acesso à área de membros." />
      <Panel className="stack-sm max-w-md">
        <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">E-mail</p>
        <p className="m-0 font-medium">{session.user.email}</p>
        {session.user.name ? (
          <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">{session.user.name}</p>
        ) : null}
      </Panel>
      <div className="stack-sm">
        <h2 className="m-0 text-[var(--text-xl)]">Definir senha</h2>
        <PasswordForm />
      </div>
    </div>
  );
}
