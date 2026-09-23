"use client";

import { Suspense, useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Mode = "manual" | "ai";

const TEMPLATES = [
  { value: "comment_dm", label: "Comentário → DM" },
  { value: "story_dm", label: "Story → DM" },
  { value: "keyword", label: "Palavra-chave em DM" },
  { value: "welcome", label: "Boas-vindas" },
];

function AutomacaoInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";

  const [brief, setBrief] = useState("");
  const [nome, setNome] = useState("Comentário → DM");
  const [template, setTemplate] = useState("comment_dm");
  const [messageText, setMessageText] = useState(
    "Olá! Obrigado pelo interesse 😊 Clique e eu te envio o link.",
  );
  const [keyword, setKeyword] = useState("quero");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [needsConnect, setNeedsConnect] = useState(false);
  const [editing, setEditing] = useState(mode === "manual");

  useEffect(() => {
    if (!mode) router.replace("/criar/p/instagram");
  }, [mode, router]);

  function applyAi() {
    const text = brief.trim().toLowerCase();
    if (text.includes("story")) {
      setTemplate("story_dm");
      setNome("Story → DM");
    } else if (text.includes("keyword") || text.includes("palavra")) {
      setTemplate("keyword");
      setNome("Palavra-chave em DM");
    } else if (text.includes("boas") || text.includes("welcome")) {
      setTemplate("welcome");
      setNome("Boas-vindas");
    } else {
      setTemplate("comment_dm");
      setNome("Comentário → DM");
    }
    const kw =
      brief.match(/["']([^"']+)["']/)?.[1] ||
      brief.match(/\b(quero|link|info|sim)\b/i)?.[1];
    if (kw) setKeyword(kw);
    setMessageText(
      brief.trim().slice(0, 280) ||
        "Olá! Obrigado pelo interesse 😊 Clique e eu te envio o link.",
    );
    setEditing(true);
  }

  async function activate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError(null);
    setNeedsConnect(false);
    try {
      const r = await fetch("/api/symbius/flows", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          nome: nome.trim() || "Automação",
          template,
          messageText: messageText.trim(),
          status: "PUBLISHED",
          triggerConfig:
            template === "comment_dm" || template === "keyword"
              ? { keywords: [keyword.trim() || "quero"] }
              : undefined,
        }),
      });
      const j = await r.json();
      if (r.status === 401 || r.status === 403) {
        setNeedsConnect(true);
        throw new Error("Conecte o Instagram para ativar a automação.");
      }
      if (!r.ok) {
        if (String(j.error || "").toLowerCase().includes("instagram") || r.status === 400) {
          setNeedsConnect(true);
        }
        throw new Error(j.error || "Não foi possível ativar.");
      }
      const id = j.fluxo?.id || j.id || "";
      router.push(
        `/criar/sucesso?kind=automacao&id=${encodeURIComponent(id)}&name=${encodeURIComponent(nome.trim())}`,
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Falha ao ativar");
    } finally {
      setSaving(false);
    }
  }

  if (!mode) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  return (
    <AppPage
      title="Automação"
      narrow
      actions={
        <BackLink href={via === "assistente" ? "/criar/p/instagram?mode=ai" : "/criar/p/instagram"} />
      }
    >
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Criar · {via === "assistente" ? "Assistente" : "Manual"} · Automação · Ativar
      </p>

      {mode === "ai" && !editing ? (
        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Descreva a automação</span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder='Ex.: Quando comentarem "quero" no post, manda o link da oferta…'
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <Button type="button" variant="primary" onClick={applyAi} disabled={!brief.trim()}>
              Gerar estrutura
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/instagram?mode=ai" : "/criar/p/instagram"} />
          </div>
        </div>
      ) : null}

      {editing ? (
        <form onSubmit={activate} className="mt-4 space-y-4">
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Nome</span>
            <input className={fieldClass} value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <div>
            <p className="mb-1.5 type-micro-legal text-[var(--ink-muted-48)]">Modelo</p>
            <PillSelect
              size="field"
              aria-label="Modelo"
              value={template}
              onChange={setTemplate}
              options={TEMPLATES}
            />
          </div>
          {(template === "comment_dm" || template === "keyword") && (
            <label className="block">
              <span className="type-micro-legal text-[var(--ink-muted-48)]">Palavra-chave</span>
              <input className={fieldClass} value={keyword} onChange={(e) => setKeyword(e.target.value)} />
            </label>
          )}
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">Mensagem no Direct</span>
            <textarea
              value={messageText}
              onChange={(e) => setMessageText(e.target.value)}
              rows={4}
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
            />
          </label>

          {needsConnect ? (
            <div className="rounded-lg border border-[var(--hairline)] bg-[var(--canvas-parchment)] p-4">
              <p className="type-caption text-[var(--ink)]">Conecte o Instagram para ativar.</p>
              <Link
                href="/social/connect"
                className="mt-2 inline-block type-caption-strong text-[var(--primary)]"
              >
                Conectar Instagram
              </Link>
            </div>
          ) : null}

          {error && !needsConnect ? (
            <p className="type-caption text-[var(--danger)]">{error}</p>
          ) : null}

          <div className="flex flex-wrap gap-2 pt-2">
            <Button type="submit" variant="primary" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {saving ? "Ativando…" : "Ativar"}
            </Button>
            <BackLink href={via === "assistente" ? "/criar/p/instagram?mode=ai" : "/criar/p/instagram"} />
          </div>
        </form>
      ) : null}
    </AppPage>
  );
}

export default function CriarAutomacaoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <AutomacaoInner />
    </Suspense>
  );
}
