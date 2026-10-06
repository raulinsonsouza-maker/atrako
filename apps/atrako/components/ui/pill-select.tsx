"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Check, ChevronDown } from "lucide-react";
import { cn } from "@/lib/utils";

export type PillSelectOption = {
  value: string;
  label: string;
  /** Cor da opção (ex.: etapa do CRM) — ponto no trigger e no menu */
  color?: string | null;
  /** Contagem à direita, só no menu (o trigger mostra apenas o rótulo) */
  count?: number;
};

export type PillSelectSize = "toolbar" | "field";

type Props = {
  value: string;
  onChange: (value: string) => void;
  options: PillSelectOption[];
  placeholder?: string;
  "aria-label"?: string;
  className?: string;
  /** @deprecated Prefira `size="field"` — mantido para migração */
  triggerClassName?: string;
  disabled?: boolean;
  align?: "left" | "right";
  /**
   * toolbar — filtros / barras (h-9, default)
   * field — formulários full-width (h-11)
   */
  size?: PillSelectSize;
};

/**
 * Select canônico do DS (`pill-select` no YAML).
 * Nunca usar `<select>` nativo no produto.
 */
export function PillSelect({
  value,
  onChange,
  options,
  placeholder = "Selecionar",
  "aria-label": ariaLabel,
  className,
  triggerClassName,
  disabled,
  align = "left",
  size = "toolbar",
}: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const label = selected?.label ?? placeholder;
  const isField = size === "field";
  useDismiss(open, setOpen, rootRef);

  return (
    <div ref={rootRef} className={cn("pill-select", isField && "w-full", className)}>
      <button
        type="button"
        disabled={disabled}
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-open={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        className={cn(
          "pill-select-trigger type-caption",
          isField && "pill-select-trigger-field",
          triggerClassName,
        )}
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          {selected?.color ? (
            <span
              className="pill-select-swatch"
              style={{ background: selected.color }}
              aria-hidden
            />
          ) : null}
          <span
            className={cn(
              "truncate",
              !selected && "pill-select-label-muted",
            )}
          >
            {label}
          </span>
        </span>
        <ChevronDown
          className={cn(
            "h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)] transition",
            open && "rotate-180",
          )}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-label={ariaLabel}
          className={cn(
            "pill-select-menu",
            align === "right" ? "pill-select-menu-right" : "pill-select-menu-left",
          )}
        >
          {options.map((opt) => {
            const active = opt.value === value;
            return (
              <li key={opt.value || "__all"} role="option" aria-selected={active}>
                <button
                  type="button"
                  data-active={active ? "true" : "false"}
                  onClick={() => {
                    onChange(opt.value);
                    setOpen(false);
                  }}
                  className={cn(
                    "pill-select-option type-caption",
                    active && "type-caption-strong",
                  )}
                >
                  {opt.color ? (
                    <span
                      className="pill-select-swatch"
                      style={{ background: opt.color }}
                      aria-hidden
                    />
                  ) : null}
                  <span className="truncate">{opt.label}</span>
                  <OptionCount count={opt.count} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

function useDismiss(open: boolean, setOpen: (v: boolean) => void, rootRef: React.RefObject<HTMLDivElement | null>) {
  useEffect(() => {
    if (!open) return;
    function onDoc(e: MouseEvent) {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open, setOpen, rootRef]);
}

function OptionCount({ count }: { count?: number }) {
  if (count == null) return null;
  return <span className="ml-auto pl-3 type-caption tabular-nums text-[var(--ink-muted-48)]">{count}</span>;
}

type MultiProps = {
  value: string[];
  onChange: (value: string[]) => void;
  options: PillSelectOption[];
  /** Rótulo com nada marcado; também é a primeira opção do menu, que limpa a seleção. */
  allLabel: string;
  "aria-label"?: string;
  className?: string;
  align?: "left" | "right";
};

/**
 * Variante de múltipla escolha do `pill-select` (YAML `pill-select-multi`).
 * O menu fica aberto enquanto marca; o trigger resume ("Meta Ads +2").
 */
export function PillMultiSelect({
  value,
  onChange,
  options,
  allLabel,
  "aria-label": ariaLabel,
  className,
  align = "left",
}: MultiProps) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const listId = useId();
  useDismiss(open, setOpen, rootRef);

  const picked = new Set(value);
  const firstLabel = options.find((o) => o.value === value[0])?.label ?? value[0];
  const label = value.length === 0 ? allLabel : value.length === 1 ? firstLabel : `${firstLabel} +${value.length - 1}`;
  const toggle = (v: string) => onChange(picked.has(v) ? value.filter((x) => x !== v) : [...value, v]);

  return (
    <div ref={rootRef} className={cn("pill-select", className)}>
      <button
        type="button"
        aria-label={ariaLabel}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={listId}
        data-open={open ? "true" : "false"}
        onClick={() => setOpen((v) => !v)}
        className="pill-select-trigger type-caption"
      >
        <span className="flex min-w-0 flex-1 items-center gap-2">
          <span className="truncate">{label}</span>
        </span>
        <ChevronDown
          className={cn("h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)] transition", open && "rotate-180")}
          strokeWidth={1.75}
        />
      </button>

      {open ? (
        <ul
          id={listId}
          role="listbox"
          aria-multiselectable="true"
          aria-label={ariaLabel}
          className={cn("pill-select-menu", align === "right" ? "pill-select-menu-right" : "pill-select-menu-left")}
        >
          <li role="option" aria-selected={value.length === 0}>
            <button
              type="button"
              data-active={value.length === 0 ? "true" : "false"}
              onClick={() => {
                onChange([]);
                setOpen(false);
              }}
              className={cn("pill-select-option type-caption", value.length === 0 && "type-caption-strong")}
            >
              <span className="truncate">{allLabel}</span>
            </button>
          </li>
          {options.map((opt) => {
            const active = picked.has(opt.value);
            return (
              <li key={opt.value} role="option" aria-selected={active}>
                <button
                  type="button"
                  data-active={active ? "true" : "false"}
                  onClick={() => toggle(opt.value)}
                  className={cn("pill-select-option type-caption", active && "type-caption-strong")}
                >
                  <span className="pill-select-check" data-checked={active ? "true" : "false"} aria-hidden>
                    {active ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
                  </span>
                  {opt.color ? (
                    <span className="pill-select-swatch" style={{ background: opt.color }} aria-hidden />
                  ) : null}
                  <span className="truncate">{opt.label}</span>
                  <OptionCount count={opt.count} />
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
