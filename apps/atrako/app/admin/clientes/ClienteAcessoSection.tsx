"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { TextField } from "@/components/ui/text-field";

interface MemberRow {
  id: string;
  email: string;
  name: string | null;
  role: string;
  hasPassword: boolean;
}

const ROLE_OPTIONS = [
  { value: "OWNER", label: "Proprietário" },
  { value: "ADMIN", label: "Administrador" },
  { value: "OPERATOR", label: "Operador" },
  { value: "ANALYST", label: "Analista" },
];

const ROLE_LABEL = Object.fromEntries(ROLE_OPTIONS.map((r) => [r.value, r.label]));

export function ClienteAcessoSection({ clienteId }: { clienteId: string }) {
  const queryClient = useQueryClient();
  const queryKey = ["admin", "clientes", clienteId, "acesso"];
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState("OWNER");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [inviteUrl, setInviteUrl] = useState("");
  const [copied, setCopied] = useState(false);

  const { data: members = [] } = useQuery<MemberRow[]>({
    queryKey,
    queryFn: async () => {
      const r = await fetch(`/api/admin/clientes/${clienteId}/acesso`);
      if (!r.ok) return [];
      const data = (await r.json()) as { members?: MemberRow[] };
      return data.members ?? [];
    },
  });

  async function submit(withPassword: boolean) {
    setError("");
    setSuccess("");
    setInviteUrl("");
    setCopied(false);
    setPending(true);
    try {
      const res = await fetch(`/api/admin/clientes/${clienteId}/acesso`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, role, password: withPassword ? password : undefined }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        mode?: "password" | "invite";
        acceptUrl?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Não foi possível salvar o acesso.");
        return;
      }
      if (data.mode === "invite" && data.acceptUrl) {
        setInviteUrl(data.acceptUrl);
        setSuccess("Link gerado (válido 14 dias).");
      } else {
        setSuccess(`Senha definida para ${email.trim().toLowerCase()}.`);
        setPassword("");
      }
      queryClient.invalidateQueries({ queryKey });
    } finally {
      setPending(false);
    }
  }

  async function copyInvite() {
    await navigator.clipboard.writeText(inviteUrl);
    setCopied(true);
  }

  return (
    <div className="space-y-3 border-t border-[var(--hairline)] pt-4">
      <p className="type-caption-strong text-[var(--ink)]">Acesso</p>

      {members.length > 0 ? (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 type-caption">
              <span className="truncate text-[var(--ink)]">{m.email}</span>
              <span className="shrink-0 type-fine-print text-[var(--ink-muted-48)]">
                {ROLE_LABEL[m.role] ?? m.role}
                {m.hasPassword ? "" : " · convite"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-fine-print text-[var(--ink-muted-48)]">Nenhum acesso ainda.</p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_8rem]">
        <TextField
          label="E-mail"
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="cliente@empresa.com"
          autoComplete="off"
        />
        <div>
          <p className="type-caption-strong text-[var(--ink)]">Papel</p>
          <div className="mt-2">
            <PillSelect
              size="field"
              value={role}
              onChange={setRole}
              options={ROLE_OPTIONS}
              aria-label="Papel"
            />
          </div>
        </div>
      </div>

      <TextField
        label="Senha"
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Opcional — vazio gera convite"
        autoComplete="new-password"
      />

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !email || !password} onClick={() => submit(true)}>
          Definir senha
        </Button>
        <Button type="button" variant="outline" disabled={pending || !email} onClick={() => submit(false)}>
          Gerar convite
        </Button>
      </div>

      {error ? <p className="type-caption text-[var(--accent)]">{error}</p> : null}
      {success ? (
        <div className="space-y-2 rounded-[var(--radius-xs)] bg-[var(--success)]/10 px-3 py-2 type-caption text-[var(--success)]">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {success}
          </p>
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <input
                readOnly
                value={inviteUrl}
                onFocus={(e) => e.target.select()}
                className="h-11 min-w-0 flex-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-3 type-fine-print text-[var(--ink)] outline-none"
              />
              <Button type="button" variant="outline" onClick={copyInvite} aria-label="Copiar link">
                <Copy className="h-3.5 w-3.5" />
                {copied ? "Copiado" : "Copiar"}
              </Button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
