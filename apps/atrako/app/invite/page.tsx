"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";

function InviteAcceptForm() {
  const router = useRouter();
  const params = useSearchParams();
  const token = params.get("token") ?? "";
  const [name, setName] = useState("");
  const [password, setPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    if (password !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch("/api/auth/member/accept-invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ token, password, name: name || undefined }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        setError((data as { error?: string }).error ?? "Não foi possível aceitar o convite.");
        return;
      }
      router.replace("/config");
      router.refresh();
    } catch {
      setError("Não foi possível aceitar o convite.");
    } finally {
      setSaving(false);
    }
  }

  if (!token) {
    return (
      <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5">
        <h1 className="type-tagline">Convite inválido</h1>
        <p className="type-body text-[var(--ink-secondary)]">Token ausente na URL.</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 bg-[var(--canvas-parchment)]">
      <h1 className="type-tagline text-[var(--ink)]">Aceitar convite</h1>
      <p className="type-body text-[var(--ink-secondary)]">
        Defina sua senha para acessar o workspace.
      </p>
      <form onSubmit={submit} className="flex flex-col gap-3">
        <label className="type-fine-print flex flex-col gap-1">
          Nome
          <input
            className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </label>
        <PasswordField
          label="Senha"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          autoComplete="new-password"
        />
        <PasswordField
          label="Confirmar senha"
          value={confirmation}
          onChange={(e) => setConfirmation(e.target.value)}
          autoComplete="new-password"
        />
        {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Salvando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export default function InviteAcceptPage() {
  return (
    <Suspense fallback={<main className="p-5 type-body">Carregando…</main>}>
      <InviteAcceptForm />
    </Suspense>
  );
}
