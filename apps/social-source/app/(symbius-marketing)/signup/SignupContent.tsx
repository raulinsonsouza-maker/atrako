"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { SymbiusLogo } from "@/components/symbius/SymbiusLogo";
import { MetaOAuthAuthButton } from "@/components/symbius/MetaOAuthAuthButton";

export function SignupContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-white px-4 py-12 text-zinc-900">
      <div className="w-full max-w-md">
        <div className="mb-8 text-zinc-900 [&_a]:text-zinc-900">
          <SymbiusLogo size="sm" />
        </div>

        <h1 className="text-3xl font-bold tracking-tight text-zinc-900">
          Criar conta
        </h1>
        <p className="mt-2 text-sm text-zinc-500">
          Conecte seu Instagram Professional e comece a automatizar em minutos.
        </p>

        {error && (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            {error}
          </p>
        )}

        <MetaOAuthAuthButton
          returnTo="/app"
          label="Continuar com Instagram"
        />

        <p className="mt-4 text-center text-xs leading-relaxed text-zinc-400">
          Na primeira vez autorizamos as permissões do Instagram (mensagens e
          comentários). Enquanto você estiver logado, entra direto no Symbius.
          Se sair da conta ou a sessão expirar, use Instagram para entrar de
          novo — sem precisar autorizar permissões outra vez.
        </p>

        <div className="my-8 flex items-center gap-3">
          <div className="h-px flex-1 bg-zinc-200" />
          <span className="text-xs font-semibold uppercase tracking-wide text-zinc-400">
            OU
          </span>
          <div className="h-px flex-1 bg-zinc-200" />
        </div>

        <p className="text-center text-sm text-zinc-500">
          Já tem conta?{" "}
          <Link
            href="/login"
            className="font-semibold text-[#6366f1] hover:underline"
          >
            Entrar
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
