"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigBack, useConfigWorkspace } from "../_components";
import { Loader2 } from "lucide-react";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Administrador",
  OPERATOR: "Operador",
  VIEWER: "Visualizador",
};

function roleLabel(role: string) {
  return ROLE_LABELS[role] ?? role;
}

export default function ConfigMembrosPage() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["workspace-members", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/members?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ members: Array<{ id: string; email: string; name: string | null; role: string }> }>;
    },
    enabled: Boolean(workspaceId),
  });

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    await fetch("/api/atrako/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, email: email.trim(), name: name.trim() || null, role: "OPERATOR" }),
    });
    setEmail("");
    setName("");
    qc.invalidateQueries({ queryKey: ["workspace-members", workspaceId] });
  }

  return (
    <div className="mx-auto max-w-lg space-y-6 p-6">
      <ConfigBack title="Membros" />
      <form onSubmit={addMember} className="flex flex-wrap gap-2 rounded-xl border border-[var(--hairline)] bg-white p-4">
        <input
          className="min-w-[140px] flex-1 rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm"
          placeholder="Nome"
          value={name}
          onChange={(e) => setName(e.target.value)}
        />
        <input
          className="min-w-[180px] flex-1 rounded-lg border border-[var(--hairline)] px-3 py-2 text-sm"
          placeholder="email@empresa.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <button type="submit" className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-[22px] py-[11px] type-body text-[var(--on-primary)] active:scale-95">
          Adicionar
        </button>
      </form>
      {isLoading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <ul className="divide-y divide-[#f4f4f5] rounded-xl border border-[var(--hairline)] bg-white">
          {(data?.members ?? []).map((m) => (
            <li key={m.id} className="flex justify-between px-4 py-3 text-sm">
              <span>
                {m.name || m.email}
                <span className="ml-2 text-xs text-[var(--ink-muted-48)]">{m.email}</span>
              </span>
              <span className="text-xs text-[var(--ink-muted-48)]">{roleLabel(m.role)}</span>
            </li>
          ))}
          {(data?.members ?? []).length === 0 ? (
            <li className="px-4 py-6 text-center type-caption text-[var(--ink-muted-48)]">
              Convide o primeiro membro da equipe pelo formulário acima.
            </li>
          ) : null}
        </ul>
      )}
    </div>
  );
}
