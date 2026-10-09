"use client";

import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";

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

const inputClass =
  "w-full rounded-xl border border-[var(--border)] bg-[var(--background)] px-4 py-2.5 type-caption transition-colors focus:border-[var(--primary)]/40 focus:outline-none";

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
        setSuccess("Link gerado (válido por 14 dias). Envie ao cliente para ele definir a senha.");
      } else {
        setSuccess(`Acesso salvo. O cliente entra em /sign-in com ${email.trim().toLowerCase()} e a senha definida.`);
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
    <div className="space-y-4 rounded-xl border border-[var(--border)] bg-[var(--muted)]/10 p-4">
      <div className="flex items-center gap-2">
        <div className="h-1 w-1 rounded-full bg-[var(--primary)]" />
        <p className="type-caption-strong uppercase text-[var(--muted-foreground)]">
          Acesso do cliente
        </p>
      </div>

      {members.length > 0 ? (
        <ul className="divide-y divide-[var(--border)] rounded-xl border border-[var(--border)]">
          {members.map((m) => (
            <li key={m.id} className="flex items-center justify-between gap-3 px-3 py-2 type-caption">
              <span className="truncate text-[var(--foreground)]">{m.email}</span>
              <span className="shrink-0 type-fine-print text-[var(--muted-foreground)]">
                {ROLE_LABEL[m.role] ?? m.role} · {m.hasPassword ? "senha definida" : "convite pendente"}
              </span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="type-fine-print text-[var(--muted-foreground)]">
          Ninguém acessa a área do cliente deste workspace ainda.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-[1fr_auto]">
        <input
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          placeholder="E-mail de login do cliente"
          autoComplete="off"
          className={inputClass}
        />
        <PillSelect size="field" value={role} onChange={setRole} options={ROLE_OPTIONS} aria-label="Papel" />
      </div>
      <input
        type="password"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        placeholder="Senha (mín. 8, com maiúscula e caractere especial)"
        autoComplete="new-password"
        className={inputClass}
      />
      <p className="type-fine-print text-[var(--muted-foreground)]">
        Defina a senha agora ou gere um link para o próprio cliente escolher. Para quem já tem acesso, os dois
        também servem para trocar a senha.
      </p>

      <div className="flex flex-wrap gap-2">
        <Button type="button" disabled={pending || !email || !password} onClick={() => submit(true)}>
          Definir senha
        </Button>
        <Button type="button" variant="outline" disabled={pending || !email} onClick={() => submit(false)}>
          Gerar link de convite
        </Button>
      </div>

      {error ? <p className="type-caption text-[var(--accent)]">{error}</p> : null}
      {success ? (
        <div className="space-y-2 rounded-lg bg-[var(--success)]/10 px-3 py-2 type-caption text-[var(--success)]">
          <p className="flex items-center gap-2">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            {success}
          </p>
          {inviteUrl ? (
            <div className="flex items-center gap-2">
              <input readOnly value={inviteUrl} className={inputClass} onFocus={(e) => e.target.select()} />
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
