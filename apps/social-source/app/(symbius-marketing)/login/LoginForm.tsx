"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState } from "react";
import { SymbiusLogo } from "@/components/symbius/SymbiusLogo";
import { MetaOAuthAuthButton } from "@/components/symbius/MetaOAuthAuthButton";

export function LoginForm() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const next = searchParams.get("next") ?? "/app";
  const oauthError = searchParams.get("error");
  const [error, setError] = useState(oauthError ?? "");
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError("");
    setLoading(true);
    const fd = new FormData(e.currentTarget);
    const res = await fetch("/api/symbius/auth/login", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        email: fd.get("email"),
        password: fd.get("password"),
      }),
    });
    const data = await res.json();
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Credenciais inválidas");
      return;
    }
    router.push(next);
    router.refresh();
  }

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12 text-zinc-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-zinc-900 [&_a]:text-zinc-900">
          <SymbiusLogo size="sm" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Bem-vindo de volta
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Seus leads e automações estão esperando por você.
        </p>

        <MetaOAuthAuthButton returnTo={next} />

        <p className="mt-3 text-center text-xs leading-relaxed text-zinc-400">
          Enquanto você estiver logado, entra direto no Symbius. Se sair da
          conta ou a sessão expirar, use Instagram para entrar de novo — sem
          precisar autorizar permissões outra vez.
        </p>

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            OU
          </span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <form onSubmit={onSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800">
              E-mail <span className="text-red-500">*</span>
            </label>
            <input
              name="email"
              type="email"
              required
              placeholder="seu@email.com"
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none placeholder:text-zinc-400 focus:border-[#818cf8] focus:ring-2 focus:ring-[#818cf8]/25"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-sm font-semibold text-zinc-800">
              Senha <span className="text-red-500">*</span>
            </label>
            <input
              name="password"
              type="password"
              required
              className="w-full rounded-xl border border-zinc-200 bg-white px-4 py-3 text-sm text-zinc-900 outline-none focus:border-[#818cf8] focus:ring-2 focus:ring-[#818cf8]/25"
            />
          </div>
          {error && (
            <p className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-xl bg-[#818cf8] px-4 py-3.5 text-sm font-semibold text-white transition hover:bg-[#6366f1] disabled:opacity-60"
          >
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-zinc-500">
          Ainda não tem acesso?{" "}
          <Link
            href="/signup"
            className="font-semibold text-[#6366f1] hover:underline"
          >
            Criar conta
          </Link>
        </p>

        <p className="mt-10 text-center text-xs text-zinc-400">
          <Link href="/privacy" className="hover:text-zinc-600">
            Política de Privacidade
          </Link>
          <span className="mx-2">·</span>
          <Link href="/pricing" className="hover:text-zinc-600">
            Termos / Planos
          </Link>
        </p>
      </div>
    </main>
  );
}
