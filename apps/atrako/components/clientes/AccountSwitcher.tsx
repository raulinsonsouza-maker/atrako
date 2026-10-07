"use client";

import { useRouter } from "next/navigation";
import { PillSelect } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";

/** Título do dashboard + conta exibida (seletor quando há mais de uma). */
export function AccountSwitcher({ id, nome }: { id: string; nome?: string }) {
  const router = useRouter();
  const { workspaces } = useActiveWorkspace();
  const contas = workspaces
    .filter((c) => c.ativo !== false)
    .sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));

  return (
    <div className="flex min-w-0 flex-wrap items-center gap-3">
      <h1 className="type-tagline text-[var(--ink)]">Dashboard</h1>
      {contas.length > 1 ? (
        <PillSelect
          value={id}
          onChange={(next) => {
            if (next !== id) router.push(`/clientes/${next}`);
          }}
          options={contas.map((c) => ({ value: c.id, label: c.nome }))}
          aria-label="Conta"
        />
      ) : nome ? (
        <span className="type-caption truncate text-[var(--ink-muted-48)]">{nome}</span>
      ) : null}
    </div>
  );
}
