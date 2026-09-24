"use client";

import { FormEvent, Suspense, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Eye, EyeOff } from "lucide-react";
import { Button } from "@/components/ui/button";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="type-fine-print text-[var(--ink-muted-48)]">{children}</span>;
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const [identifier, setIdentifier] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [saving, setSaving] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError("");
    setSaving(true);
    try {
      const res = await fetch("/api/auth/session-login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ identifier, password }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        kind?: "member" | "platform";
        redirect?: string;
        mustChangePassword?: boolean;
        role?: string;
      };
      if (!res.ok) {
        setError(data.error ?? "Falha no login.");
        return;
      }

      let dest = data.redirect || "/assistente";
      if (data.mustChangePassword) {
        dest = "/change-password";
      } else if (nextParam?.startsWith("/") && !nextParam.startsWith("//")) {
        const nextIsAdmin = nextParam.startsWith("/admin");
        if (data.kind === "platform" && nextIsAdmin) {
          dest = nextParam;
        } else if (data.kind === "member" && !nextIsAdmin) {
          dest = nextParam === "/" ? "/assistente" : nextParam;
        } else if (data.kind === "platform" && !nextIsAdmin) {
          dest = data.role === "ADMIN" ? data.redirect || "/admin/clientes" : nextParam;
        }
      }

      router.replace(dest);
      router.refresh();
    } catch {
      setError("Falha no login.");
    } finally {
      setSaving(false);
    }
  }

  const fieldClass =
    "h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-body text-[var(--ink)] outline-none placeholder:text-[var(--ink-muted-48)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]";

  return (
    <div className="grid min-h-dvh bg-[var(--canvas-parchment)] md:grid-cols-2">
      <aside className="relative flex flex-col justify-between bg-[var(--surface-black)] px-8 py-8 text-[var(--on-dark)] md:px-12 md:py-10">
        <Link href="/" className="type-tagline text-[var(--on-dark)]">
          Atrako
        </Link>
        <div className="mt-10 max-w-sm md:mt-0">
          <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--ink-muted-48)]">
            Acesso
          </p>
          <p className="type-tagline mt-3 text-[var(--on-dark)]">
            Um login. Dois destinos.
          </p>
          <p className="type-body mt-3 text-[var(--body-muted)]">
            E-mail do workspace abre a operação. Usuário staff abre o admin.
          </p>
        </div>
        <p className="mt-10 type-fine-print text-[var(--ink-muted-48)] md:mt-0">
          © {new Date().getFullYear()} Atrako
        </p>
      </aside>

      <main className="flex flex-col justify-center px-6 py-12 sm:px-10 md:px-14 lg:px-20">
        <div className="mx-auto w-full max-w-[380px]">
          <h1 className="type-tagline text-[var(--ink)]">Entrar</h1>
          <p className="type-body mt-2 text-[var(--ink-muted-48)]">
            Use o e-mail da equipe ou o usuário Atrako.
          </p>

          <form onSubmit={submit} className="mt-8 flex flex-col gap-5">
            <label className="flex flex-col gap-1.5">
              <FieldLabel>E-mail ou usuário</FieldLabel>
              <input
                className={fieldClass}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                placeholder="voce@empresa.com"
                autoComplete="username"
                autoFocus
                required
              />
            </label>

            <label className="flex flex-col gap-1.5">
              <FieldLabel>Senha</FieldLabel>
              <span className="relative block">
                <input
                  type={showPassword ? "text" : "password"}
                  className={`${fieldClass} pr-11`}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--ink-muted-48)] transition active:scale-95"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error ? (
              <p className="type-fine-print text-[var(--accent)]" role="alert">
                {error}
              </p>
            ) : null}

            <Button type="submit" disabled={saving || !identifier || !password} className="w-full">
              {saving ? "Entrando…" : "Continuar"}
            </Button>
          </form>
        </div>
      </main>
    </div>
  );
}

export default function SignInPage() {
  return (
    <Suspense
      fallback={
        <main className="flex min-h-dvh items-center justify-center bg-[var(--canvas-parchment)]">
          <p className="type-body text-[var(--ink-muted-48)]">Carregando…</p>
        </main>
      }
    >
      <SignInForm />
    </Suspense>
  );
}
