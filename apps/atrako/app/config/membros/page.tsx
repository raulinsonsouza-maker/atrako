"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfigPage, ConfigSection, useConfigWorkspace } from "../_components";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { TextField } from "@/components/ui/text-field";

type Role = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";
type Member = { id: string; email: string; name: string | null; role: Role };

const ROLES: Array<{ value: Role; label: string; desc: string }> = [
  { value: "OWNER", label: "Proprietário", desc: "Acesso total, inclusive equipe e integrações." },
  { value: "ADMIN", label: "Administrador", desc: "Configurações, integrações e equipe." },
  { value: "OPERATOR", label: "Operador", desc: "Leads, atendimento, agenda e loja do dia a dia." },
  { value: "ANALYST", label: "Analista", desc: "Acompanha resultados, sem alterar nada." },
];

const INVITE_ROLES = ROLES.filter((r) => r.value !== "OWNER");

function roleLabel(role: string) {
  return ROLES.find((r) => r.value === role)?.label ?? role;
}

export default function ConfigMembrosPage() {
  const qc = useQueryClient();
  const { workspaceId, isReady } = useConfigWorkspace();
  const [email, setEmail] = useState("");
  const [name, setName] = useState("");
  const [role, setRole] = useState<Role>("OPERATOR");
  const [adding, setAdding] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const queryKey = ["workspace-members", workspaceId];
  const { data, isLoading, isError } = useQuery({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/atrako/members?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error(r.status === 403 ? "forbidden" : "fail");
      return r.json() as Promise<{ members: Member[] }>;
    },
    enabled: Boolean(workspaceId),
    retry: false,
  });
  const members = data?.members ?? [];

  async function call(input: RequestInfo, init: RequestInit) {
    setError(null);
    const r = await fetch(input, init);
    if (!r.ok) {
      const j = await r.json().catch(() => ({}));
      setError(j.error || "Não foi possível concluir.");
      return false;
    }
    await qc.invalidateQueries({ queryKey });
    return true;
  }

  async function addMember(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !email.trim()) return;
    setAdding(true);
    const ok = await call("/api/atrako/members", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, email: email.trim(), name: name.trim() || null, role }),
    });
    setAdding(false);
    if (ok) {
      setEmail("");
      setName("");
      setRole("OPERATOR");
    }
  }

  async function changeRole(memberId: string, next: string) {
    if (!workspaceId) return;
    setBusyId(memberId);
    await call("/api/atrako/members", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ workspaceId, memberId, role: next }),
    });
    setBusyId(null);
  }

  async function removeMember(memberId: string) {
    if (!workspaceId) return;
    setBusyId(memberId);
    await call(
      `/api/atrako/members?workspaceId=${encodeURIComponent(workspaceId)}&memberId=${encodeURIComponent(memberId)}`,
      { method: "DELETE" },
    );
    setBusyId(null);
    setConfirmRemove(null);
  }

  const inviteRoleDesc = INVITE_ROLES.find((r) => r.value === role)?.desc;

  return (
    <ConfigPage title="Equipe" loading={!isReady || isLoading}>
      {isError ? (
        <div className="utility-card">
          <p className="type-caption text-[var(--ink-muted-80)]">
            Só proprietários e administradores podem ver e gerenciar a equipe.
          </p>
        </div>
      ) : (
        <>
          <ConfigSection title="Convidar" description="A pessoa entra com este e-mail.">
            <form onSubmit={addMember} className="space-y-5">
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField
                  label="Nome"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome"
                />
                <TextField
                  label="E-mail"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="email@empresa.com"
                  required
                />
              </div>
              <div>
                <p className="type-caption-strong text-[var(--ink)]">Papel</p>
                <PillSelect
                  className="mt-2 w-full"
                  size="field"
                  value={role}
                  onChange={(v) => setRole(v as Role)}
                  options={INVITE_ROLES.map((r) => ({ value: r.value, label: r.label }))}
                  aria-label="Papel"
                />
                {inviteRoleDesc ? (
                  <p className="mt-1.5 type-fine-print text-[var(--ink-muted-48)]">{inviteRoleDesc}</p>
                ) : null}
              </div>
              <Button type="submit" variant="primary" disabled={adding || !email.trim()}>
                {adding ? "Adicionando…" : "Adicionar à equipe"}
              </Button>
            </form>
          </ConfigSection>

          <section className="space-y-3">
            <h2 className="type-caption-strong text-[var(--ink-muted-80)]">
              {members.length === 1 ? "1 pessoa" : `${members.length} pessoas`}
            </h2>
            <ul className="overflow-hidden rounded-[18px] border border-[var(--hairline)] bg-[var(--canvas)]">
              {members.map((m, i) => (
                <li
                  key={m.id}
                  className={`flex flex-wrap items-center gap-3 px-4 py-3.5 ${
                    i > 0 ? "border-t border-[var(--divider-soft)]" : ""
                  }`}
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate type-caption-strong text-[var(--ink)]">
                      {m.name || m.email}
                    </span>
                    {m.name ? (
                      <span className="block truncate type-fine-print text-[var(--ink-muted-48)]">
                        {m.email}
                      </span>
                    ) : null}
                  </span>
                  <PillSelect
                    value={m.role}
                    onChange={(v) => void changeRole(m.id, v)}
                    options={ROLES.map((r) => ({ value: r.value, label: r.label }))}
                    aria-label={`Papel de ${m.name || m.email}`}
                    disabled={busyId === m.id}
                    align="right"
                  />
                  {confirmRemove === m.id ? (
                    <span className="flex items-center gap-1">
                      <Button
                        type="button"
                        variant="ghost"
                        className="!text-[var(--danger)]"
                        disabled={busyId === m.id}
                        onClick={() => void removeMember(m.id)}
                      >
                        Confirmar
                      </Button>
                      <Button type="button" variant="ghost" onClick={() => setConfirmRemove(null)}>
                        Cancelar
                      </Button>
                    </span>
                  ) : (
                    <Button
                      type="button"
                      variant="ghost"
                      onClick={() => setConfirmRemove(m.id)}
                      aria-label={`Remover ${m.name || m.email}`}
                    >
                      Remover
                    </Button>
                  )}
                </li>
              ))}
              {members.length === 0 ? (
                <li className="px-4 py-6 text-center type-caption text-[var(--ink-muted-48)]">
                  Convide a primeira pessoa da equipe pelo formulário acima.
                </li>
              ) : null}
            </ul>
            {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              {ROLES.map((r) => `${r.label}: ${r.desc.replace(/\.$/, "")}`).join(" · ")}
            </p>
          </section>
        </>
      )}
    </ConfigPage>
  );
}
