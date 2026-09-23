"use client";

import { useEffect, useMemo, useState, type ReactNode, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import {
  Blocks,
  FilePlus2,
  Sparkles,
  X,
  Zap,
} from "lucide-react";
import { CommentDmWizard, type CommentDmConfig } from "@/components/symbius/CommentDmWizard";
import { StoryReplyWizard } from "@/components/symbius/StoryReplyWizard";
import { BackLink } from "@/components/ui/back-link";
import { SearchInput } from "@/components/ui/search-input";
import {
  FLOW_TEMPLATES,
  OBJECTIVE_FILTERS,
  TRIGGER_FILTERS,
  type FlowTemplate,
} from "@/lib/symbius/flowTemplates";

type WizardMode = null | "comment_dm" | "story_dm";

function Badge({
  children,
  tone,
}: {
  children: ReactNode;
  tone: "popular" | "pro" | "ai" | "soon" | "quick" | "used";
}) {
  const cls =
    tone === "popular"
      ? "bg-pink-100 text-pink-600"
      : tone === "pro"
        ? "bg-amber-100 text-amber-700"
        : tone === "ai"
          ? "bg-violet-100 text-violet-700"
          : tone === "soon"
            ? "bg-[var(--canvas-parchment)] text-zinc-500"
            : tone === "used"
              ? "bg-sky-100 text-sky-700"
              : "bg-emerald-100 text-emerald-700";
  return (
    <span
      className={`rounded-full px-2 py-0.5 type-micro-legal uppercase tracking-wide ${cls}`}
    >
      {children}
    </span>
  );
}

export default function NewFlowPage() {
  return (
    <Suspense fallback={<div className="p-10 text-zinc-500">Carregando…</div>}>
      <NewFlowPageInner />
    </Suspense>
  );
}

function NewFlowPageInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [q, setQ] = useState("");
  const [objective, setObjective] = useState<string>("all");
  const [trigger, setTrigger] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [wizard, setWizard] = useState<WizardMode>(null);
  const [wizardPreset, setWizardPreset] = useState<Partial<CommentDmConfig>>();
  const [showTemplates, setShowTemplates] = useState(false);

  async function createSimple(
    action: "keyword" | "welcome" | "blank",
    title: string,
  ) {
    setLoading(true);
    const res = await fetch("/api/symbius/flows", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ nome: title, template: action }),
    });
    const data = await res.json();
    setLoading(false);
    if (res.ok) router.push(`/social/flows/${data.fluxo.id}`);
    else alert(data.error ?? "Erro");
  }

  function openTemplate(t: FlowTemplate) {
    if (t.action === "soon") {
      alert("Este modelo estará disponível em breve.");
      return;
    }
    if (t.action === "comment_dm") {
      setShowTemplates(false);
      setWizardPreset(t.preset as Partial<CommentDmConfig> | undefined);
      setWizard("comment_dm");
      return;
    }
    if (t.action === "story_dm") {
      setShowTemplates(false);
      setWizard("story_dm");
      return;
    }
    if (
      t.action === "keyword" ||
      t.action === "welcome" ||
      t.action === "blank"
    ) {
      setShowTemplates(false);
      void createSimple(t.action, t.title.slice(0, 60));
    }
  }

  useEffect(() => {
    const recipeId = searchParams.get("recipe");
    if (recipeId) {
      const t = FLOW_TEMPLATES.find((x) => x.id === recipeId);
      if (t) {
        openTemplate(t);
        return;
      }
    }
    const template = searchParams.get("template");
    if (template === "comment_dm") setWizard("comment_dm");
    else if (template === "story_dm" || template === "story") setWizard("story_dm");
    else if (template === "keyword_dm" || template === "keyword") {
      void createSimple("keyword", "Keyword em DM");
    } else if (template === "welcome") {
      void createSimple("welcome", "Boas-vindas");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    return FLOW_TEMPLATES.filter((t) => {
      if (objective !== "all" && !t.objectives.includes(objective as never)) {
        return false;
      }
      if (trigger && !t.triggers.includes(trigger as never)) return false;
      if (!needle) return true;
      return (
        t.title.toLowerCase().includes(needle) ||
        t.description.toLowerCase().includes(needle)
      );
    });
  }, [q, objective, trigger]);

  const recommended = FLOW_TEMPLATES.filter((t) => t.recommended);

  if (wizard === "comment_dm") {
    return (
      <CommentDmWizard
        defaultName="Comentário → DM"
        initial={wizardPreset}
        onCancel={() => {
          setWizard(null);
          setWizardPreset(undefined);
          if (searchParams.get("recipe")) {
            router.push("/criar/p/instagram");
          }
        }}
        onSaved={() => router.push("/social/flows")}
      />
    );
  }

  if (wizard === "story_dm") {
    return (
      <StoryReplyWizard
        defaultName="Resposta ao Story → DM"
        onCancel={() => {
          setWizard(null);
          if (searchParams.get("recipe")) {
            router.push("/criar/p/instagram");
          }
        }}
        onSaved={() => router.push("/social/flows")}
      />
    );
  }

  return (
    <div className="symbius-light relative min-h-full bg-[#f4f5f7] text-[var(--ink)]">
      <div className="border-b border-[var(--hairline)] bg-white px-5 py-3">
        <BackLink href="/social/flows">Automações</BackLink>
      </div>

      <div className="mx-auto flex max-w-5xl flex-col px-5 py-10 md:py-16">
        <div className="text-center">
          <h1 className="type-tagline text-[var(--ink)]">
            Como você quer criar sua automação?
          </h1>
          <p className="mt-2 text-sm text-zinc-500">
            Escolha o caminho que faz mais sentido agora
          </p>
        </div>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {/* IA — em breve */}
          <button
            type="button"
            disabled
            className="group relative flex cursor-not-allowed flex-col items-center rounded-2xl border border-[var(--hairline)] bg-white px-6 py-10 text-center opacity-90 shadow-sm"
          >
            <span className="absolute left-3 top-3">
              <Badge tone="soon">Em breve</Badge>
            </span>
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-sky-100 to-indigo-100">
              <Sparkles className="h-9 w-9 text-[var(--primary)]" />
            </div>
            <h2 className="mt-5 type-tagline text-[var(--ink)]">Criar com Symbius IA</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Descreva a automação e a IA faz o resto.
            </p>
          </button>

          {/* Templates */}
          <button
            type="button"
            onClick={() => setShowTemplates(true)}
            className="group flex flex-col items-center rounded-2xl border border-[var(--hairline)] bg-white px-6 py-10 text-center shadow-sm transition hover:border-[var(--primary)] hover:shadow-md"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-blue-50 to-sky-100 transition group-hover:scale-105">
              <Blocks className="h-9 w-9 text-[var(--primary)]" />
            </div>
            <h2 className="mt-5 type-tagline text-[var(--ink)]">Começar com template</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Templates de automação que mais convertem no Instagram
            </p>
          </button>

          {/* Do zero */}
          <button
            type="button"
            disabled={loading}
            onClick={() => createSimple("blank", "Sem título")}
            className="group flex flex-col items-center rounded-2xl border border-[var(--hairline)] bg-white px-6 py-10 text-center shadow-sm transition hover:border-[var(--primary)] hover:shadow-md disabled:opacity-60"
          >
            <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gradient-to-br from-zinc-50 to-zinc-100 transition group-hover:scale-105">
              <FilePlus2 className="h-9 w-9 text-[var(--ink-muted-80)]" />
            </div>
            <h2 className="mt-5 type-tagline text-[var(--ink)]">Criar do zero</h2>
            <p className="mt-2 text-sm leading-relaxed text-zinc-500">
              Monte sua automação bloco a bloco, no seu ritmo.
            </p>
            {loading && (
              <p className="mt-3 type-fine-print text-[var(--primary)]">
                Abrindo construtor…
              </p>
            )}
          </button>
        </div>
      </div>

      {/* Modal de templates */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6">
          <div
            className="absolute inset-0"
            onClick={() => setShowTemplates(false)}
            aria-hidden
          />
          <div className="relative flex max-h-[92vh] w-full max-w-5xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl">
            <div className="flex items-center justify-between border-b border-[var(--hairline)] px-5 py-4">
              <div>
                <h2 className="type-tagline text-[var(--ink)]">Escolha um template</h2>
                <p className="text-sm text-zinc-500">
                  Modelos prontos para Instagram
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowTemplates(false)}
                className="rounded-lg p-2 text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)] hover:text-[var(--ink)]"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="border-b border-zinc-100 px-5 py-3">
              <div className="max-w-md">
                <SearchInput
                  size="toolbar"
                  value={q}
                  onChange={(e) => setQ(e.target.value)}
                  placeholder="Buscar modelos…"
                  autoFocus
                />
              </div>
            </div>

            <div className="flex min-h-0 flex-1 overflow-hidden">
              <aside className="hidden w-52 shrink-0 overflow-y-auto border-r border-zinc-100 p-4 sm:block">
                <p className="mb-2 type-micro-legal uppercase tracking-wide text-[var(--ink-muted-48)]">
                  Por objetivo
                </p>
                <nav className="mb-5 space-y-0.5">
                  {OBJECTIVE_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setObjective(f.id);
                        setTrigger(null);
                      }}
                      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${
                        objective === f.id && !trigger
                          ? "bg-[var(--primary-glow)] type-body-strong text-[var(--primary)]"
                          : "text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </nav>
                <p className="mb-2 type-micro-legal uppercase tracking-wide text-[var(--ink-muted-48)]">
                  Por gatilho
                </p>
                <nav className="space-y-0.5">
                  {TRIGGER_FILTERS.map((f) => (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => {
                        setTrigger(f.id);
                        setObjective("all");
                      }}
                      className={`block w-full rounded-lg px-2.5 py-1.5 text-left text-sm ${
                        trigger === f.id
                          ? "bg-[var(--primary-glow)] type-body-strong text-[var(--primary)]"
                          : "text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                      }`}
                    >
                      {f.label}
                    </button>
                  ))}
                </nav>
              </aside>

              <div className="flex-1 overflow-y-auto p-5">
                {!q && !trigger && objective === "all" && (
                  <section className="mb-8">
                    <h3 className="flex items-center gap-2 type-caption-strong text-[var(--ink)]">
                      <Zap className="h-4 w-4 text-[var(--primary)]" />
                      Recomendados
                    </h3>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      {recommended.map((t) => (
                        <TemplateCard
                          key={t.id}
                          t={t}
                          disabled={loading}
                          onClick={() => openTemplate(t)}
                        />
                      ))}
                    </div>
                  </section>
                )}

                <section>
                  <h3 className="type-caption-strong text-[var(--ink)]">
                    {trigger
                      ? TRIGGER_FILTERS.find((x) => x.id === trigger)?.label
                      : objective !== "all"
                        ? OBJECTIVE_FILTERS.find((x) => x.id === objective)
                            ?.label
                        : "Todos os modelos"}
                  </h3>
                  <div className="mt-3 grid gap-3 sm:grid-cols-2">
                    {filtered.map((t) => (
                      <TemplateCard
                        key={t.id}
                        t={t}
                        disabled={loading}
                        onClick={() => openTemplate(t)}
                      />
                    ))}
                    {filtered.length === 0 && (
                      <p className="col-span-full py-8 text-center text-sm text-zinc-500">
                        Nenhum modelo encontrado.
                      </p>
                    )}
                  </div>
                </section>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function TemplateCard({
  t,
  disabled,
  onClick,
}: {
  t: FlowTemplate;
  disabled?: boolean;
  onClick: () => void;
}) {
  const unavailable = t.action === "soon";
  return (
    <button
      type="button"
      disabled={disabled || unavailable}
      onClick={onClick}
      className={`flex h-full flex-col rounded-xl border border-[var(--hairline)] bg-white p-4 text-left transition ${
        unavailable
          ? "cursor-not-allowed opacity-55"
          : "hover:border-[var(--primary)] hover:shadow-sm"
      }`}
    >
      <div className="flex flex-wrap gap-1.5">
        {t.popular && <Badge tone="popular">Popular</Badge>}
        {t.kind === "quick" && !unavailable && (
          <Badge tone="quick">Quick</Badge>
        )}
        {t.pro && <Badge tone="pro">PRO</Badge>}
        {t.ai && <Badge tone="ai">AI</Badge>}
        {unavailable && <Badge tone="soon">Em breve</Badge>}
      </div>
      <p className="mt-2.5 type-body-strong leading-snug text-[var(--ink)]">
        {t.title}
      </p>
      <p className="mt-1.5 flex-1 text-sm text-zinc-500">{t.description}</p>
    </button>
  );
}
