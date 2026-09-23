"use client";

import { useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  Plus,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { SalesPageView } from "@/components/commerce/SalesPageView";
import {
  newSectionId,
  type LpGoal,
  type LpSalesPageV1,
  type LpSection,
} from "@/lib/criar/lp-schema";

const fieldClass =
  "mt-1 h-10 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Props = {
  value: LpSalesPageV1;
  onChange: (next: LpSalesPageV1) => void;
  productName: string;
  priceCents: number;
  brandName?: string;
};

const SECTION_LABEL: Record<LpSection["type"], string> = {
  hero: "Hero",
  benefits: "Benefícios",
  social_proof: "Prova social",
  faq: "FAQ",
  form: "Formulário Atrako",
  checkout: "Checkout Atrako",
  cta: "Botão CTA",
};

function addableTypes(goal: LpGoal): LpSection["type"][] {
  const base: LpSection["type"][] = [
    "hero",
    "benefits",
    "social_proof",
    "faq",
    "cta",
  ];
  if (goal === "leads") return [...base, "form"];
  return [...base, "checkout"];
}

function defaultSection(type: LpSection["type"]): LpSection {
  const id = newSectionId();
  switch (type) {
    case "hero":
      return { id, type, headline: "Nova headline", subheadline: "" };
    case "benefits":
      return { id, type, items: ["Benefício 1", "Benefício 2"] };
    case "social_proof":
      return { id, type, quotes: [{ text: "Depoimento…", author: "" }] };
    case "faq":
      return { id, type, items: [{ q: "Pergunta?", a: "Resposta." }] };
    case "form":
      return { id, type, title: "Deixe seus dados" };
    case "checkout":
      return { id, type };
    case "cta":
      return { id, type, label: "Quero começar" };
  }
}

export function AtrakoLpEditor({
  value,
  onChange,
  productName,
  priceCents,
  brandName = "Sua marca",
}: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    value.sections[0]?.id ?? null,
  );
  const [addType, setAddType] = useState<string>(
    value.goal === "leads" ? "form" : "checkout",
  );

  const selected = value.sections.find((s) => s.id === selectedId) ?? null;

  function updateSections(sections: LpSection[]) {
    onChange({ ...value, sections });
  }

  function patchSelected(patch: Partial<LpSection> | LpSection) {
    if (!selected) return;
    updateSections(
      value.sections.map((s) =>
        s.id === selected.id ? ({ ...s, ...patch } as LpSection) : s,
      ),
    );
  }

  function move(id: string, dir: -1 | 1) {
    const i = value.sections.findIndex((s) => s.id === id);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= value.sections.length) return;
    const next = [...value.sections];
    const [row] = next.splice(i, 1);
    next.splice(j, 0, row);
    updateSections(next);
  }

  function remove(id: string) {
    const next = value.sections.filter((s) => s.id !== id);
    updateSections(next);
    if (selectedId === id) setSelectedId(next[0]?.id ?? null);
  }

  function addSection() {
    const type = addType as LpSection["type"];
    if (!addableTypes(value.goal).includes(type)) return;
    if (
      (type === "form" || type === "checkout") &&
      value.sections.some((s) => s.type === type)
    ) {
      return;
    }
    const s = defaultSection(type);
    updateSections([...value.sections, s]);
    setSelectedId(s.id);
  }

  const previewProduct = {
    id: "preview",
    name: productName || "Oferta",
    slug: "preview",
    priceCents,
    description: null,
    clienteId: "",
  };

  return (
    <div className="lp-editor">
      <aside className="lp-editor-rail">
        <p className="type-fine-print uppercase tracking-[0.12em] text-[var(--ink-muted-48)]">
          Seções
        </p>
        <ul className="lp-editor-list">
          {value.sections.map((s, idx) => (
            <li key={s.id}>
              <button
                type="button"
                className="lp-editor-item"
                data-active={selectedId === s.id ? "true" : "false"}
                onClick={() => setSelectedId(s.id)}
              >
                <span className="type-caption-strong text-[var(--ink)]">
                  {SECTION_LABEL[s.type]}
                </span>
                <span className="flex gap-0.5">
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1 text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(s.id, -1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") move(s.id, -1);
                    }}
                  >
                    <ChevronUp className="h-3.5 w-3.5" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1 text-[var(--ink-muted-48)] hover:bg-[var(--canvas-parchment)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      move(s.id, 1);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") move(s.id, 1);
                    }}
                  >
                    <ChevronDown className="h-3.5 w-3.5" />
                  </span>
                  <span
                    role="button"
                    tabIndex={0}
                    className="rounded p-1 text-[var(--danger)] hover:bg-[var(--canvas-parchment)]"
                    onClick={(e) => {
                      e.stopPropagation();
                      remove(s.id);
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter") remove(s.id);
                    }}
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </span>
                </span>
              </button>
              {idx < value.sections.length - 1 ? null : null}
            </li>
          ))}
        </ul>

        <div className="mt-3 flex flex-col gap-2">
          <PillSelect
            size="field"
            value={addType}
            onChange={setAddType}
            options={addableTypes(value.goal).map((t) => ({
              value: t,
              label: SECTION_LABEL[t],
            }))}
            aria-label="Tipo de seção"
          />
          <Button type="button" variant="secondary-pill" onClick={addSection}>
            <Plus className="h-4 w-4" strokeWidth={1.75} />
            Adicionar
          </Button>
        </div>

        {selected ? (
          <div className="lp-editor-props">
            <p className="type-fine-print uppercase tracking-[0.12em] text-[var(--ink-muted-48)]">
              Editar · {SECTION_LABEL[selected.type]}
            </p>
            <SectionFields section={selected} onChange={patchSelected} />
          </div>
        ) : null}
      </aside>

      <div className="lp-editor-canvas">
        <p className="mb-3 type-fine-print text-[var(--ink-muted-48)]">
          Preview da landing
        </p>
        <div className="lp-editor-stage">
          <SalesPageView
            page={value}
            product={previewProduct}
            brandName={brandName}
            currency="BRL"
            preview
          />
        </div>
      </div>
    </div>
  );
}

function SectionFields({
  section,
  onChange,
}: {
  section: LpSection;
  onChange: (patch: Partial<LpSection> | LpSection) => void;
}) {
  if (section.type === "hero") {
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Headline</span>
          <input
            className={fieldClass}
            value={section.headline}
            onChange={(e) => onChange({ headline: e.target.value })}
          />
        </label>
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Subheadline</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 py-2 type-caption"
            rows={3}
            value={section.subheadline || ""}
            onChange={(e) => onChange({ subheadline: e.target.value })}
          />
        </label>
      </div>
    );
  }
  if (section.type === "benefits") {
    return (
      <label className="block">
        <span className="type-micro-legal text-[var(--ink-muted-48)]">
          Itens (um por linha)
        </span>
        <textarea
          className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 py-2 type-caption"
          rows={5}
          value={section.items.join("\n")}
          onChange={(e) =>
            onChange({
              items: e.target.value
                .split("\n")
                .map((x) => x.trim())
                .filter(Boolean),
            })
          }
        />
      </label>
    );
  }
  if (section.type === "social_proof") {
    const q = section.quotes[0] || { text: "", author: "" };
    return (
      <div className="space-y-3">
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Depoimento</span>
          <textarea
            className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 py-2 type-caption"
            rows={3}
            value={q.text}
            onChange={(e) =>
              onChange({ quotes: [{ ...q, text: e.target.value }] })
            }
          />
        </label>
        <label className="block">
          <span className="type-micro-legal text-[var(--ink-muted-48)]">Autor</span>
          <input
            className={fieldClass}
            value={q.author || ""}
            onChange={(e) =>
              onChange({ quotes: [{ ...q, author: e.target.value }] })
            }
          />
        </label>
      </div>
    );
  }
  if (section.type === "faq") {
    return (
      <div className="space-y-3">
        {section.items.map((item, i) => (
          <div key={i} className="space-y-2 rounded-lg border border-[var(--hairline)] p-3">
            <input
              className={fieldClass}
              placeholder="Pergunta"
              value={item.q}
              onChange={(e) => {
                const items = [...section.items];
                items[i] = { ...item, q: e.target.value };
                onChange({ items });
              }}
            />
            <textarea
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-3 py-2 type-caption"
              rows={2}
              placeholder="Resposta"
              value={item.a}
              onChange={(e) => {
                const items = [...section.items];
                items[i] = { ...item, a: e.target.value };
                onChange({ items });
              }}
            />
          </div>
        ))}
        <Button
          type="button"
          variant="secondary-pill"
          onClick={() =>
            onChange({
              items: [...section.items, { q: "Nova pergunta?", a: "" }],
            })
          }
        >
          + Pergunta
        </Button>
      </div>
    );
  }
  if (section.type === "form") {
    return (
      <label className="block">
        <span className="type-micro-legal text-[var(--ink-muted-48)]">Título do form</span>
        <input
          className={fieldClass}
          value={section.title || ""}
          onChange={(e) => onChange({ title: e.target.value })}
        />
        <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
          Conversão: Form Atrako → CRM
        </p>
      </label>
    );
  }
  if (section.type === "checkout") {
    return (
      <p className="type-fine-print text-[var(--ink-muted-48)]">
        Bloco de checkout Atrako (Mercado Pago). O preço da oferta alimenta este bloco.
      </p>
    );
  }
  if (section.type === "cta") {
    return (
      <label className="block">
        <span className="type-micro-legal text-[var(--ink-muted-48)]">Texto do botão</span>
        <input
          className={fieldClass}
          value={section.label}
          onChange={(e) => onChange({ label: e.target.value })}
        />
      </label>
    );
  }
  return null;
}
