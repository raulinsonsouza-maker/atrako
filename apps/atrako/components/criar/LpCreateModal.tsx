"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  Eye,
  Sparkles,
  LayoutTemplate,
  PenLine,
  Upload,
  X,
} from "lucide-react";
import { IconButton } from "@/components/ui/icon-button";
import { PillSelect } from "@/components/ui/pill-select";
import { LpTemplatePreviewDialog } from "@/components/criar/LpTemplatePreviewDialog";
import type { LpGoal } from "@/lib/criar/lp-schema";
import {
  allTemplates,
  getTemplateMeta,
  type LpTemplateId,
} from "@/lib/criar/puck/templates";

export type LpCreateStep = "entry" | "template" | "ai";

type Props = {
  open: boolean;
  step: LpCreateStep;
  onStepChange: (step: LpCreateStep) => void;
  onClose: () => void;
  onSelectTemplate: (templateId: LpTemplateId, goal: LpGoal) => void;
  onStartBlank: () => void;
  onStartAi: (goal: LpGoal) => void;
  templateFilter?: "all" | "leads" | "sales";
  sortMode?: "recent" | "relevant";
};

export function LpCreateModal({
  open,
  step,
  onStepChange,
  onClose,
  onSelectTemplate,
  onStartBlank,
  onStartAi,
  templateFilter = "all",
  sortMode: sortModeProp = "relevant",
}: Props) {
  const [sortMode, setSortMode] = useState<"recent" | "relevant">(sortModeProp);
  const [filter, setFilter] = useState(templateFilter);
  const [previewId, setPreviewId] = useState<LpTemplateId | null>(null);
  const [aiGoal, setAiGoal] = useState<LpGoal>("leads");

  useEffect(() => {
    if (!open) {
      setPreviewId(null);
      return;
    }
    setFilter(templateFilter);
    setSortMode(sortModeProp);
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") {
        if (previewId) return;
        if (step === "template" || step === "ai") {
          onStepChange("entry");
        } else {
          onClose();
        }
      }
    }
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = prev;
    };
  }, [open, onClose, onStepChange, step, previewId, templateFilter, sortModeProp]);

  const templates = useMemo(() => {
    let list = allTemplates();
    if (filter === "leads") list = list.filter((t) => t.goal === "leads");
    if (filter === "sales") list = list.filter((t) => t.goal === "sales");
    if (sortMode === "relevant") {
      list = [...list].sort(
        (a, b) =>
          Number(Boolean(b.recommended)) - Number(Boolean(a.recommended)) ||
          (a.sortOrder ?? 99) - (b.sortOrder ?? 99),
      );
    } else {
      list = [...list].sort(
        (a, b) => (b.sortOrder ?? 0) - (a.sortOrder ?? 0),
      );
    }
    return list;
  }, [filter, sortMode]);

  if (!open) return null;

  const isGallery = step === "template";

  function pickTemplate(id: LpTemplateId) {
    const meta = getTemplateMeta(id);
    if (!meta) return;
    onSelectTemplate(id, meta.goal);
  }

  function importSoon() {
    window.alert(
      "Importação Figma, HTML e export de outras IAs — em breve no Atrako.",
    );
  }

  return (
    <div
      className="funnel-config-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="lp-create-title"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className="lp-create-modal"
        data-entry={step === "entry" ? "true" : undefined}
        data-wide={isGallery ? "true" : undefined}
        data-fullscreen={isGallery ? "true" : undefined}
      >
        <header className="lp-create-modal-head">
          <div className="min-w-0 flex-1">
            {step !== "entry" ? (
              <button
                type="button"
                className="lp-create-back type-fine-print text-[var(--ink-muted-48)]"
                onClick={() => onStepChange("entry")}
              >
                <ArrowLeft className="h-3.5 w-3.5" strokeWidth={1.75} />
                Voltar
              </button>
            ) : null}
            <h2 id="lp-create-title" className="type-tagline text-[var(--ink)]">
              {step === "entry"
                ? "Como você quer começar?"
                : step === "template"
                  ? "Escolha um template que combine com seu estilo"
                  : "Criar com IA"}
            </h2>
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              {step === "entry"
                ? "Um editor para captura, vendas ou páginas híbridas."
                : step === "template"
                  ? "Layouts prontos — edite tudo depois no construtor."
                  : "Descreva a oferta; montamos a estrutura inicial no canvas."}
            </p>
          </div>
          <IconButton type="button" aria-label="Fechar" onClick={onClose}>
            <X className="h-4 w-4" strokeWidth={1.75} />
          </IconButton>
        </header>

        <div className="lp-create-modal-body" data-entry={step === "entry" ? "true" : undefined}>
          {step === "entry" ? (
            <div className="lp-create-entry-grid">
              <button
                type="button"
                className="lp-create-entry-card"
                onClick={() => onStepChange("ai")}
              >
                <span className="lp-create-entry-icon" aria-hidden>
                  <Sparkles className="h-7 w-7" strokeWidth={1.35} />
                </span>
                <span className="lp-create-entry-copy">
                  <span className="type-caption-strong text-[var(--ink)]">
                    Criar com IA
                  </span>
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    Descreva a oferta e montamos a estrutura no editor.
                  </span>
                </span>
                <span className="lp-create-entry-cta">Continuar</span>
              </button>
              <button
                type="button"
                className="lp-create-entry-card"
                onClick={() => onStepChange("template")}
              >
                <span className="lp-create-entry-icon" aria-hidden>
                  <LayoutTemplate className="h-7 w-7" strokeWidth={1.35} />
                </span>
                <span className="lp-create-entry-copy">
                  <span className="type-caption-strong text-[var(--ink)]">
                    Usar um template
                  </span>
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    Layouts prontos para captura e vendas.
                  </span>
                </span>
                <span className="lp-create-entry-cta">Escolher template</span>
              </button>
              <button
                type="button"
                className="lp-create-entry-card"
                onClick={() => {
                  onStartBlank();
                  onClose();
                }}
              >
                <span className="lp-create-entry-icon" aria-hidden>
                  <PenLine className="h-7 w-7" strokeWidth={1.35} />
                </span>
                <span className="lp-create-entry-copy">
                  <span className="type-caption-strong text-[var(--ink)]">
                    Criar do zero
                  </span>
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    Canvas vazio — adicione elementos no construtor.
                  </span>
                </span>
                <span className="lp-create-entry-cta">Começar</span>
              </button>
              <button
                type="button"
                className="lp-create-entry-card"
                data-soon="true"
                onClick={importSoon}
              >
                <span className="lp-create-soon-badge type-micro-legal">
                  Em breve
                </span>
                <span className="lp-create-entry-icon" aria-hidden>
                  <Upload className="h-7 w-7" strokeWidth={1.35} />
                </span>
                <span className="lp-create-entry-copy">
                  <span className="type-caption-strong text-[var(--ink)]">
                    Importar
                  </span>
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    Figma, HTML ou página gerada por outra IA.
                  </span>
                </span>
                <span className="lp-create-entry-cta">Saiba mais</span>
              </button>
            </div>
          ) : null}

          {step === "ai" ? (
            <div className="lp-create-ai-panel max-w-lg">
              <label className="block">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Objetivo principal
                </span>
                <div className="mt-2">
                  <PillSelect
                    size="field"
                    value={aiGoal}
                    onChange={(v) => setAiGoal(v as LpGoal)}
                    options={[
                      { value: "leads", label: "Captura de leads" },
                      { value: "sales", label: "Venda / checkout" },
                    ]}
                    aria-label="Objetivo"
                  />
                </div>
              </label>
              <p className="mt-4 type-fine-print text-[var(--ink-muted-48)]">
                Na próxima tela, descreva nome, preço e benefícios — você poderá
                ajustar blocos depois.
              </p>
              <button
                type="button"
                className="lp-pages-btn-primary mt-6"
                onClick={() => {
                  onStartAi(aiGoal);
                  onClose();
                }}
              >
                Continuar para o brief
              </button>
            </div>
          ) : null}

          {step === "template" ? (
            <>
              <div className="lp-template-gallery-toolbar">
                <div className="lp-template-gallery-tabs" role="tablist">
                  <button
                    type="button"
                    role="tab"
                    className="lp-template-gallery-tab"
                    data-active={sortMode === "recent" ? "true" : undefined}
                    onClick={() => setSortMode("recent")}
                  >
                    Mais recentes
                  </button>
                  <button
                    type="button"
                    role="tab"
                    className="lp-template-gallery-tab"
                    data-active={
                      sortMode === "relevant" ? "true" : undefined
                    }
                    onClick={() => setSortMode("relevant")}
                  >
                    Mais relevantes
                  </button>
                </div>
                <PillSelect
                  value={filter}
                  onChange={(v) =>
                    setFilter(v as "all" | "leads" | "sales")
                  }
                  options={[
                    { value: "all", label: "Todos" },
                    { value: "leads", label: "Captura" },
                    { value: "sales", label: "Vendas" },
                  ]}
                  aria-label="Filtrar templates"
                />
              </div>
              <div className="lp-template-gallery-grid">
                {templates.map((t) => (
                  <article key={t.id} className="lp-template-gallery-card">
                    <button
                      type="button"
                      className="lp-template-card lp-template-card--gallery"
                      data-tone={t.tone}
                      onClick={() => pickTemplate(t.id)}
                    >
                      <div className="lp-template-preview" aria-hidden>
                        <span className="lp-template-preview-bar" />
                        <span className="lp-template-preview-hero" />
                        <span className="lp-template-preview-rows">
                          <i />
                          <i />
                          <i />
                        </span>
                      </div>
                    </button>
                    <div className="lp-template-gallery-meta">
                      <p className="type-caption-strong text-[var(--ink)]">
                        {t.title}
                      </p>
                      <p className="type-micro-legal text-[var(--ink-muted-48)]">
                        Criado por Atrako ·{" "}
                        {t.goal === "leads" ? "Captura" : "Vendas"}
                      </p>
                      <div className="lp-template-gallery-actions">
                        <button
                          type="button"
                          className="lp-pages-btn-secondary"
                          onClick={(e) => {
                            e.preventDefault();
                            e.stopPropagation();
                            setPreviewId(t.id);
                          }}
                        >
                          <Eye className="h-4 w-4" strokeWidth={1.75} />
                          Preview
                        </button>
                        <button
                          type="button"
                          className="lp-pages-btn-primary"
                          onClick={() => pickTemplate(t.id)}
                        >
                          Escolher
                        </button>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </div>

      {previewId ? (
        <LpTemplatePreviewDialog
          templateId={previewId}
          onClose={() => setPreviewId(null)}
          onChoose={(id) => {
            pickTemplate(id);
            setPreviewId(null);
          }}
        />
      ) : null}
    </div>
  );
}
