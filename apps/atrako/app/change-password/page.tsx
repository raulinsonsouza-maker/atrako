"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { PasswordField } from "@/components/auth/PasswordField";

export default function ChangePasswordPage() {
  const router = useRouter();
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmation, setConfirmation] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    if (newPassword !== confirmation) {
      setError("As senhas não coincidem.");
      return;
    }
    setSaving(true);
    try {
      const response = await fetch("/api/auth/change-password", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ currentPassword, newPassword }),
      });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) {
        setError(result.error ?? "Não foi possível alterar a senha.");
        return;
      }
      router.replace("/clientes");
      router.refresh();
    } catch {
      setError("Não foi possível alterar a senha.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="flex min-h-[calc(100vh-5rem)] items-center justify-center px-4 py-10">
      <form onSubmit={submit} className="w-full max-w-md space-y-5 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-7 shadow-2xl">
        <div>
          <h1 className="text-2xl font-semibold">Alterar senha</h1>
          <p className="mt-1 text-sm text-[var(--muted-foreground)]">Altere sua senha quando quiser.</p>
        </div>
        <PasswordField
          label="Senha atual"
          required
          autoComplete="current-password"
          value={currentPassword}
          onChange={(event) => setCurrentPassword(event.target.value)}
        />
        <PasswordField
          label="Nova senha"
          required
          minLength={12}
          autoComplete="new-password"
          value={newPassword}
          onChange={(event) => setNewPassword(event.target.value)}
        />
        <PasswordField
          label="Confirme a nova senha"
          required
          minLength={12}
          autoComplete="new-password"
          value={confirmation}
          onChange={(event) => setConfirmation(event.target.value)}
        />
        {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
        <button disabled={saving} type="submit" className="w-full rounded-lg bg-[var(--primary)] px-4 py-2.5 font-semibold text-black disabled:opacity-60">
          {saving ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </main>
  );
}