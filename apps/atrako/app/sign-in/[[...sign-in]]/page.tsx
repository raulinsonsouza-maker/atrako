"use client";

import { FormEvent, Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { AlertCircle, ArrowRight, Eye, EyeOff, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLpBrand } from "@/components/layout/LpHostContext";
import "@/app/food/food-shell.css";
import "@/app/atendimento/atendimento-shell.css";

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <span className="type-caption text-[var(--ink-muted-80)]">{children}</span>;
}

function SignInForm() {
  const router = useRouter();
  const params = useSearchParams();
  const nextParam = params.get("next");
  const lpBrand = useLpBrand();
  const lpHost = lpBrand !== null;
  const areaBase = lpHost ? "/crm" : "/atendimento";
  const nextInArea =
    nextParam === areaBase ||
    nextParam?.startsWith(`${areaBase}/`) === true ||
    nextParam?.startsWith(`${areaBase}?`) === true;
  const areaEntry = lpHost || nextInArea;
  const areaDest = nextInArea ? nextParam! : areaBase;
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
      } else if (areaEntry) {
        dest = areaDest;
      } else if (nextParam?.startsWith("/") && !nextParam.startsWith("//")) {
        const nextIsAdmin = nextParam.startsWith("/admin");
        if (data.kind === "platform" && nextIsAdmin) {
          dest = nextParam;
        } else if (data.kind === "member" && !nextIsAdmin) {
          dest = nextParam === "/" ? "/assistente" : nextParam;
        } else if (data.kind === "platform" && !nextIsAdmin) {
          dest =
            data.role === "ADMIN" && !nextParam.startsWith("/config/conexoes/")
              ? data.redirect || "/admin/clientes"
              : nextParam;
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

  const foodEntry = nextParam === "/food" || nextParam?.startsWith("/food/") === true;
  const brandedEntry = foodEntry || areaEntry;
  const branded = areaEntry
    ? {
        className: "food-sign atd-sign",
        brand: lpBrand ?? "Atendimento",
        kicker: "Área de atendimento",
        title: "Leads, conversas e o funil da equipe.",
        copy: "Cada cadastro chega aqui com a prioridade e o próximo passo.",
        lead: "Use o e-mail da equipe de atendimento.",
      }
    : {
        className: "food-sign",
        brand: "Food",
        kicker: "Restaurante",
        title: "A fila, o cardápio e o caixa.",
        copy: "Loja, WhatsApp e balcão no mesmo lugar.",
        lead: "Use o e-mail da equipe do restaurante.",
      };

  useEffect(() => {
    if (!brandedEntry) return;
    const previous = document.title;
    document.title = "Entrar";
    return () => {
      document.title = previous;
    };
  }, [brandedEntry]);
  const fieldClass =
    "h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-body text-[var(--ink)] outline-none transition-colors placeholder:text-[var(--ink-muted-48)] hover:border-[var(--ink-muted-48)] focus-visible:border-[var(--primary)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--primary-focus)]";

  if (brandedEntry) {
    return (
      <div className={branded.className}>
        <aside className="food-sign-aside">
          <p className="food-sign-brand">{branded.brand}</p>
          <div>
            <p className="food-sign-kicker">{branded.kicker}</p>
            <p className="food-sign-title">{branded.title}</p>
            <p className="food-sign-copy">{branded.copy}</p>
          </div>
          <p className="food-sign-kicker">© {new Date().getFullYear()}</p>
        </aside>
        <main className="food-sign-main">
          <div className="food-sign-card">
            <h1>Entrar</h1>
            <p className="food-sign-lead">{branded.lead}</p>
            <form onSubmit={submit}>
              <label>
                E-mail ou usuário
                <input
                  value={identifier}
                  onChange={(e) => setIdentifier(e.target.value)}
                  placeholder="voce@empresa.com"
                  autoComplete="username"
                  autoFocus
                  required
                />
              </label>
              <label>
                Senha
                <span className="relative block">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    autoComplete="current-password"
                    required
                    style={{ paddingRight: 44 }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    aria-pressed={showPassword}
                    className="food-sign-eye"
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </span>
              </label>
              {error ? (
                <p role="alert" className="food-sign-lead">
                  {error}
                </p>
              ) : null}
              <button type="submit" className="food-sign-submit" aria-busy={saving} disabled={saving || !identifier || !password}>
                {saving ? "Entrando…" : "Continuar"}
              </button>
            </form>
            {lpHost ? null : (
              <p className="food-sign-links">
                <Link href="/politica-de-privacidade">Privacidade</Link>
                {" · "}
                <Link href="/termos-de-uso">Termos</Link>
                {" · "}
                <Link href="/exclusao-de-dados">Exclusão de dados</Link>
              </p>
            )}
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="grid min-h-dvh bg-[var(--canvas-parchment)] md:grid-cols-2">
      <aside className="relative flex flex-col justify-between bg-[var(--surface-black)] px-8 py-8 text-[var(--on-dark)] md:px-12 md:py-10">
        <Link href="/" className="type-tagline text-[var(--on-dark)]">
          Atrako
        </Link>
        <div className="mt-10 max-w-sm md:mt-0">
          <p className="type-fine-print uppercase text-[var(--ink-muted-48)]">
            Inteligência comercial
          </p>
          <p className="type-display-md mt-3 text-[var(--on-dark)]">Da mídia à receita.</p>
          <p className="type-body mt-3 text-[var(--body-muted)]">
            Toda a jornada de vendas em uma única central, com um agente de IA para analisar,
            criar e acompanhar.
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

          <form onSubmit={submit} className="mt-8 flex flex-col gap-4">
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
                  className="absolute inset-y-0 right-0 flex w-11 items-center justify-center text-[var(--ink-muted-48)] transition hover:text-[var(--ink)] active:scale-95"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </span>
            </label>

            {error ? (
              <div
                role="alert"
                className="flex items-start gap-2 rounded-[var(--radius-xs)] [background:color-mix(in_srgb,var(--danger)_10%,var(--canvas))] px-3 py-2.5"
              >
                <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-[var(--danger)]" />
                <p className="type-caption text-[var(--danger)]">{error}</p>
              </div>
            ) : null}

            <Button
              type="submit"
              aria-busy={saving}
              disabled={saving || !identifier || !password}
              className="h-12 w-full"
            >
              {saving ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Entrando…
                </>
              ) : (
                <>
                  Continuar
                  <ArrowRight className="h-4 w-4" />
                </>
              )}
            </Button>
          </form>

          <p className="mt-8 type-fine-print text-[var(--ink-muted-48)]">
            <Link href="/politica-de-privacidade" className="hover:text-[var(--primary)]">
              Privacidade
            </Link>
            {" · "}
            <Link href="/termos-de-uso" className="hover:text-[var(--primary)]">
              Termos
            </Link>
            {" · "}
            <Link href="/exclusao-de-dados" className="hover:text-[var(--primary)]">
              Exclusão de dados
            </Link>
          </p>
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