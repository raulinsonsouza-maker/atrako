"use client";

import { useRef, type ReactNode } from "react";
import { ChevronDown, Loader2, Plus, Trash2, type LucideIcon } from "lucide-react";
import { Button, IconButton } from "@/components/ui";
import type { ChoiceOpt } from "@/lib/qualification/choices";

export function ScriptBlock({
  icon: Icon,
  title,
  summary,
  chips,
  open,
  onToggle,
  customized,
  off,
  aside,
  status,
  children,
  dirty,
  saving,
  onSave,
  onReset,
  message,
}: {
  icon: LucideIcon;
  title: string;
  summary?: string;
  chips?: string[];
  open: boolean;
  onToggle: () => void;
  customized?: boolean;
  off?: boolean;
  /** Fica à direita do cabeçalho (ex.: Switch liga/desliga). */
  aside?: ReactNode;
  status?: ReactNode;
  children?: ReactNode;
  dirty?: boolean;
  saving?: boolean;
  onSave?: () => void;
  onReset?: () => void;
  message?: { text: string; tone?: "ok" | "bad" } | null;
}) {
  return (
    <section className="script-block" data-open={open} data-custom={customized || undefined} data-off={off || undefined}>
      <div className="script-block-head">
        <button type="button" className="script-block-toggle" onClick={onToggle} aria-expanded={open}>
          <span className="script-block-icon">
            <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
              <span className="type-caption-strong text-[var(--ink)]">{title}</span>
              {customized ? <span className="rel-badge type-micro-legal" data-tone="warn">Personalizado</span> : null}
              {off ? <span className="rel-badge type-micro-legal">Desligado</span> : null}
            </span>
            {!open && summary ? <span className="script-block-summary type-fine-print">{summary}</span> : null}
            {!open && chips?.length ? (
              <span className="mt-1.5 flex flex-wrap gap-1">
                {chips.map((c) => (
                  <span key={c} className="script-chip type-micro-legal">
                    {c}
                  </span>
                ))}
              </span>
            ) : null}
          </span>
          <ChevronDown className="script-block-chevron h-4 w-4 text-[var(--ink-muted-48)]" aria-hidden />
        </button>
        {aside ? <div className="flex shrink-0 items-center">{aside}</div> : null}
      </div>
      {open ? (
        <div className="script-block-body">
          {status}
          {children}
          {onSave || onReset ? (
            <div className="flex flex-wrap items-center gap-2">
              {onSave ? (
                <Button size="toolbar" disabled={!dirty || saving} onClick={onSave}>
                  {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
                  Salvar
                </Button>
              ) : null}
              {onReset && customized ? (
                <Button size="toolbar" variant="ghost" disabled={saving} onClick={onReset}>
                  Restaurar padrão
                </Button>
              ) : null}
              {message ? (
                <span className={`type-fine-print ${message.tone === "bad" ? "text-[var(--danger)]" : "text-[var(--ink-muted-80)]"}`}>
                  {message.text}
                </span>
              ) : null}
            </div>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

const VAR_LABEL: Record<string, string> = { nome: "Nome", empresa: "Empresa", cidade: "Cidade", horario: "Horário" };

/** Texto da mensagem com atalhos para inserir variáveis onde está o cursor. */
export function ScriptText({
  value,
  onChange,
  vars,
  label = "Mensagem",
  rows = 3,
  hint,
}: {
  value: string;
  onChange: (value: string) => void;
  vars: string[];
  label?: string;
  rows?: number;
  hint?: string;
}) {
  const ref = useRef<HTMLTextAreaElement>(null);
  function insert(token: string) {
    const el = ref.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const next = `${value.slice(0, start)}${token}${value.slice(end)}`;
    onChange(next);
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + token.length, start + token.length);
    });
  }
  return (
    <div className="flex flex-col gap-2">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="type-fine-print text-[var(--ink-muted-48)]">{label}</span>
        <span className="flex flex-wrap gap-1">
          {vars.map((v) => (
            <button key={v} type="button" className="script-var" onClick={() => insert(`{${v}}`)}>
              <Plus className="h-3 w-3" strokeWidth={2} aria-hidden />
              {VAR_LABEL[v] ?? v}
            </button>
          ))}
        </span>
      </div>
      <textarea
        ref={ref}
        className="rel-textarea type-caption"
        rows={rows}
        value={value}
        maxLength={900}
        onChange={(e) => onChange(e.target.value)}
        aria-label={label}
      />
      {hint ? <span className="type-fine-print text-[var(--ink-muted-48)]">{hint}</span> : null}
    </div>
  );
}

/** Opções de resposta: renomear, adicionar, remover (2 a 10). */
export function OptionsEditor({ value, onChange }: { value: ChoiceOpt[]; onChange: (next: ChoiceOpt[]) => void }) {
  const asButtons = value.length <= 3 && value.every((o) => o.label.length <= 20);
  return (
    <div className="flex flex-col gap-2">
      <span className="type-fine-print text-[var(--ink-muted-48)]">
        Opções · {asButtons ? "aparecem como botões" : "aparecem numa lista"}
      </span>
      {value.map((opt, i) => (
        <div key={`${opt.code}-${i}`} className="script-option-row">
          <input
            className="rel-input type-caption"
            value={opt.label}
            maxLength={24}
            onChange={(e) => onChange(value.map((o, j) => (j === i ? { ...o, label: e.target.value } : o)))}
            aria-label={`Opção ${i + 1}`}
          />
          <IconButton
            size="toolbar"
            className="text-[var(--danger)]"
            aria-label={`Remover opção ${i + 1}`}
            disabled={value.length <= 2}
            onClick={() => onChange(value.filter((_, j) => j !== i))}
          >
            <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>
      ))}
      {value.length < 10 ? (
        <div>
          <Button size="toolbar" variant="ghost" onClick={() => onChange([...value, { code: "", label: "" }])}>
            <Plus className="h-3.5 w-3.5" />
            Adicionar opção
          </Button>
        </div>
      ) : null}
      <span className="type-fine-print text-[var(--ink-muted-48)]">Até 3 opções curtas (20 letras) viram botões; mais que isso vira lista.</span>
    </div>
  );
}
