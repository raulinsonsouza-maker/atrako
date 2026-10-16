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
  /** Busca — em `size="field"` o usuário digita no próprio campo; no toolbar a busca fica no menu. */
  searchable?: boolean;
  searchPlaceholder?: string;
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
  searchable = false,
  searchPlaceholder = "Buscar…",
}: Props) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const rootRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const listId = useId();
  const selected = options.find((o) => o.value === value);
  const isField = size === "field";
  /** Formulário: digitar no trigger abre e filtra — sem clique extra. */
  const inlineSearch = searchable && isField;
  useDismiss(open, (next) => {
    setOpen(next);
    if (!next) setQuery("");
  }, rootRef);

  useEffect(() => {
    if (!open) return;
    if (searchable && !inlineSearch) {
      const t = window.setTimeout(() => searchRef.current?.focus(), 0);
      return () => window.clearTimeout(t);
    }
  }, [open, searchable, inlineSearch]);

  const q = query.trim().toLowerCase();
  const visible =
    !searchable || !q
      ? options
      : options.filter(
          (o) => o.label.toLowerCase().includes(q) || o.value.toLowerCase().includes(q),
        );

  function pick(next: string) {
    onChange(next);
    setQuery("");
    setOpen(false);
  }

  const inputValue = open || query ? query : selected?.label ?? "";

  return (
    <div ref={rootRef} className={cn("pill-select", isField && "w-full", className)}>
      {inlineSearch ? (
        <div
          className={cn(
            "pill-select-trigger pill-select-trigger-field pill-select-trigger-combobox type-caption",
            triggerClassName,
          )}
          data-open={open ? "true" : "false"}
        >
          <input
            ref={inputRef}
            type="text"
            disabled={disabled}
            role="combobox"
            aria-label={ariaLabel}
            aria-expanded={open}
            aria-controls={listId}
            aria-autocomplete="list"
            autoComplete="off"
            placeholder={placeholder}
            value={inputValue}
            onFocus={() => setOpen(true)}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onKeyDown={(e) => {
              if (e.key === "ArrowDown") {
                e.preventDefault();
                setOpen(true);
              } else if (e.key === "Escape") {
                setOpen(false);
                setQuery("");
                inputRef.current?.blur();
              } else if (e.key === "Enter" && open && visible[0]) {
                e.preventDefault();
                pick(visible[0]!.value);
              }
            }}
            className="pill-select-combobox-input type-caption"
          />
          <ChevronDown
            className={cn(
              "h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)] transition",
              open && "rotate-180",
            )}
            strokeWidth={1.75}
            aria-hidden
          />
        </div>
      ) : (
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
            <span className={cn("truncate", !selected && "pill-select-label-muted")}>
              {selected?.label ?? placeholder}
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
      )}

      {open ? (
        <div
          className={cn(
            "pill-select-menu",
            inlineSearch ? "pill-select-menu-panel" : searchable && "pill-select-menu-panel",
            align === "right" ? "pill-select-menu-right" : "pill-select-menu-left",
          )}
        >
          {searchable && !inlineSearch ? (
            <div className="border-b border-[var(--hairline)] px-2 py-2">
              <input
                ref={searchRef}
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-9 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-1 focus:outline-[var(--primary-focus)]"
                aria-label={searchPlaceholder}
                onKeyDown={(e) => e.stopPropagation()}
              />
            </div>
          ) : null}
          <ul id={listId} role="listbox" aria-label={ariaLabel} className="max-h-[min(16rem,50vh)] overflow-y-auto">
            {visible.length === 0 ? (
              <li className="px-3 py-2 type-caption text-[var(--ink-muted-48)]">Nenhum resultado</li>
            ) : (
              visible.map((opt) => {
                const active = opt.value === value;
                return (
                  <li key={opt.value || "__all"} role="option" aria-selected={active}>
                    <button
                      type="button"
                      data-active={active ? "true" : "false"}
                      onClick={() => pick(opt.value)}
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
              })
            )}
          </ul>
        </div>
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
