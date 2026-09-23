"use client";

import { FormEvent, Suspense, useState, useTransition } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { signIn, getSession } from "next-auth/react";
import { Logo } from "@/components/brand/Logo";
import { Button } from "@/components/ui/Button";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Panel } from "@/components/ui/Panel";
import { Alert } from "@/components/ui/Alert";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";

function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const callbackUrl = searchParams.get("callbackUrl") ?? "";
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const formData = new FormData(e.currentTarget);
    const email = String(formData.get("email") ?? "")
      .trim()
      .toLowerCase();
    const password = String(formData.get("password") ?? "");

    if (!email || !password) {
      setError("Informe e-mail e senha.");
      return;
    }

    startTransition(async () => {
      const result = await signIn("credentials", {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError("E-mail ou senha inválidos.");
        return;
      }

      if (callbackUrl.startsWith("/") && !callbackUrl.startsWith("//")) {
        window.location.assign(callbackUrl);
        return;
      }

      const session = await getSession();
      if (session?.user && (session.user as { role?: string }).role === "ADMIN") {
        window.location.assign("/admin");
        return;
      }
      window.location.assign("/membros");
      router.refresh();
    });
  }

  return (
    <Panel className="w-full max-w-md stack">
      <Logo href="/" />
      <div>
        <h1 className="m-0 text-[var(--text-2xl)]">Entrar</h1>
        <p className="m-0 mt-1 text-[var(--muted)] text-[var(--text-sm)]">
          Acesse o painel ou a área de membros.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}

      <form onSubmit={onSubmit} className="stack">
        <Field label="E-mail" htmlFor="email">
          <Input id="email" name="email" type="email" autoComplete="email" required />
        </Field>
        <Field label="Senha" htmlFor="password">
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </Field>
        <Button type="submit" disabled={pending} className="w-full">
          {pending ? "Entrando…" : "Entrar"}
        </Button>
      </form>
    </Panel>
  );
}

export default function LoginPage() {
  return (
    <DarkGradientBg showLights={false}>
      <div
        data-theme="admin"
        className="min-h-screen text-[var(--ink)] flex items-center justify-center p-6"
      >
        <Suspense fallback={<Panel className="w-full max-w-md">Carregando…</Panel>}>
          <LoginForm />
        </Suspense>
      </div>
    </DarkGradientBg>
  );
}
