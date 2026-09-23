"use client";

import { FormEvent, Suspense, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { PasswordField } from "@/components/auth/PasswordField";
import { Button } from "@/components/ui/button";

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const next = params.get("next") || "/config";
  const [mode, setMode] = useState<"staff" | "member">("member");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      if (mode === "staff") {
        const res = await fetch("/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ username, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Falha no login.");
          return;
        }
        if ((data as { mustChangePassword?: boolean }).mustChangePassword) {
          router.replace("/change-password");
          return;
        }
        router.replace(next.startsWith("/admin") ? next : "/admin/clientes");
      } else {
        const res = await fetch("/api/auth/member/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ email, password }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          setError((data as { error?: string }).error ?? "Falha no login.");
          return;
        }
        router.replace(next.startsWith("/admin") ? "/config" : next);
      }
      router.refresh();
    } catch {
      setError("Falha no login.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-screen max-w-md flex-col justify-center gap-4 px-5 bg-[var(--canvas-parchment)]">
      <h1 className="type-tagline text-[var(--ink)]">Entrar</h1>
      <div className="flex gap-2">
        <Button
          type="button"
          variant={mode === "member" ? "primary" : "outline"}
          onClick={() => setMode("member")}
        >
          Workspace
        </Button>
        <Button
          type="button"
          variant={mode === "staff" ? "primary" : "outline"}
          onClick={() => setMode("staff")}
        >
          Atrako staff
        </Button>
      </div>
      <form onSubmit={submit} className="flex flex-col gap-3">
        {mode === "staff" ? (
          <label className="type-fine-print flex flex-col gap-1">
            Usuário
            <input
              className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              autoComplete="username"
            />
          </label>
        ) : (
          <label className="type-fine-print flex flex-col gap-1">
            E-mail
            <input
              type="email"
              className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="email"
            />
          </label>
        )}
        <PasswordField label="Senha" value={password} onChange={(e) => setPassword(e.target.value)} />
        {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
        <Button type="submit" disabled={saving}>
          {saving ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </main>
  );
}

export default function SignInPage() {
  return (
    <Suspense fallback={<main className="p-5 type-body">Carregando…</main>}>
      <SignInForm />
    </Suspense>
  );
}
