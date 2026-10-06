"use client";

import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, SlidersHorizontal } from "lucide-react";
import { cn } from "@/lib/utils";
import { useIsMobile } from "@/hooks/useIsMobile";
import { Button } from "./button";

export type DatePreset =
  | "all"
  | "hoje"
  | "ontem"
  | "7d"
  | "14d"
  | "30d"
  | "60d"
  | "90d"
  | "180d"
  | "365d"
  | "mesAtual"
  | "mesAnterior"
  | "trimestreAtual"
  | "semestreAtual"
  | "ytd"
  | "custom";

export type DateRangeValue = { preset: DatePreset; customInicio: string; customFim: string };

export type ResolvedDateRange = {
  label: string;
  /** Ausentes quando `preset === "all"`. */
  periodo?: string;
  dataInicio?: string;
  dataFim?: string;
};

const PRESET_OPTIONS: Array<[DatePreset, string]> = [
  ["hoje", "Hoje"],
  ["ontem", "Ontem"],
  ["7d", "Últimos 7 dias"],
  ["14d", "Últimos 14 dias"],
  ["30d", "Últimos 30 dias"],
  ["60d", "Últimos 60 dias"],
  ["90d", "Últimos 90 dias"],
  ["mesAtual", "Este mês"],
  ["mesAnterior", "Mês passado"],
  ["trimestreAtual", "Este trimestre"],
  ["ytd", "Ano atual (YTD)"],
  ["custom", "Personalizado"],
];

export function toDateInputValue(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${d}`;
}

export function fromDateInputValue(value?: string) {
  if (!value) return null;
  const [y, m, d] = value.split("-").map(Number);
  if (!y || !m || !d) return null;
  const parsed = new Date(y, m - 1, d);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatDatePt(value?: string) {
  const date = fromDateInputValue(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
}

function formatDateShort(value?: string) {
  const date = fromDateInputValue(value);
  if (!date) return "—";
  return date.toLocaleDateString("pt-BR", { day: "2-digit", month: "short" }).replace(".", "");
}

function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

function buildMonthGrid(monthDate: Date) {
  const firstDay = new Date(monthDate.getFullYear(), monthDate.getMonth(), 1);
  const startWeekday = (firstDay.getDay() + 6) % 7;
  const daysInMonth = new Date(monthDate.getFullYear(), monthDate.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startWeekday; i++) cells.push(null);
  for (let day = 1; day <= daysInMonth; day++) {
    cells.push(new Date(monthDate.getFullYear(), monthDate.getMonth(), day));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

function dateDiffInDays(start: Date, end: Date) {
  const ms = end.getTime() - start.getTime();
  return Math.max(1, Math.floor(ms / (24 * 60 * 60 * 1000)) + 1);
}

/** Período resolvido de um preset (datas locais, `YYYY-MM-DD`). */
export function resolveDateRange(value: DateRangeValue): ResolvedDateRange {
  const { preset, customInicio, customFim } = value;
  if (preset === "all") return { label: "Todo o período" };

  const hoje = new Date();
  const fim = new Date(hoje.getFullYear(), hoje.getMonth(), hoje.getDate());
  const inicio = new Date(fim);
  const make = (start: Date, end: Date, label: string): ResolvedDateRange => ({
    periodo: String(dateDiffInDays(start, end)),
    dataInicio: toDateInputValue(start),
    dataFim: toDateInputValue(end),
    label,
  });

  if (preset === "custom" && customInicio && customFim) {
    const start = fromDateInputValue(customInicio);
    const end = fromDateInputValue(customFim);
    if (start && end && start <= end) {
      return { ...make(start, end, "Personalizado"), label: `${formatDatePt(customInicio)} - ${formatDatePt(customFim)}` };
    }
  }

  switch (preset) {
    case "hoje":
      return make(fim, fim, "Hoje");
    case "ontem": {
      const ontem = new Date(fim);
      ontem.setDate(fim.getDate() - 1);
      return make(ontem, ontem, "Ontem");
    }
    case "7d":
    case "14d":
    case "30d":
    case "60d":
    case "90d":
    case "180d":
    case "365d": {
      const dias = parseInt(preset.replace("d", ""), 10);
      inicio.setDate(fim.getDate() - (dias - 1));
      return make(inicio, fim, `Últimos ${dias} dias`);
    }
    case "mesAtual":
      return make(new Date(fim.getFullYear(), fim.getMonth(), 1), fim, "Mês atual");
    case "mesAnterior":
      return make(
        new Date(fim.getFullYear(), fim.getMonth() - 1, 1),
        new Date(fim.getFullYear(), fim.getMonth(), 0),
        "Mês anterior",
      );
    case "trimestreAtual":
      return make(new Date(fim.getFullYear(), Math.floor(fim.getMonth() / 3) * 3, 1), fim, "Trimestre atual");
    case "semestreAtual":
      return make(new Date(fim.getFullYear(), fim.getMonth() < 6 ? 0 : 6, 1), fim, "Semestre atual");
    case "ytd":
      return make(new Date(fim.getFullYear(), 0, 1), fim, "Ano atual (YTD)");
    default:
      inicio.setDate(fim.getDate() - 89);
      return make(inicio, fim, "Últimos 90 dias");
  }
}

type Props = {
  value: DateRangeValue;
  onChange: (value: DateRangeValue) => void;
  /** Mostra "Todo o período" (sem recorte de data) como primeira opção. */
  allowAll?: boolean;
  /**
   * toolbar — pill de 36px das barras de filtro (CRM, listas)
   * panel — botão do topo do dashboard, com rótulo e datas
   */
  variant?: "toolbar" | "panel";
  className?: string;
};

/**
 * Filtro de período canônico (YAML `date-range-filter`): presets à esquerda,
 * dois meses à direita. Mesmo componente no dashboard e no CRM.
 */
export function DateRangeFilter({ value, onChange, allowAll = false, variant = "toolbar", className }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const [pos, setPos] = useState<{ top: number; left: number; width: number } | null>(null);
  const isMobile = useIsMobile();
  const resolved = resolveDateRange(value);
  const [visibleMonth, setVisibleMonth] = useState(() => {
    const end = fromDateInputValue(resolved.dataFim) ?? new Date();
    return new Date(end.getFullYear(), end.getMonth() - 1, 1);
  });
  const startSelected = fromDateInputValue(value.customInicio);
  const endSelected = fromDateInputValue(value.customFim);

  useEffect(() => {
    if (!open) return;
    const end = fromDateInputValue(resolveDateRange(value).dataFim);
    if (end) setVisibleMonth(new Date(end.getFullYear(), end.getMonth() - 1, 1));
    // só ao abrir: navegar meses não deve ser desfeito por re-render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    const place = () => {
      const rect = triggerRef.current?.getBoundingClientRect();
      if (!rect) return;
      const width = Math.min(860, window.innerWidth - 32);
      const left = Math.min(Math.max(16, rect.left), window.innerWidth - width - 16);
      setPos({ top: rect.bottom + 8, left, width });
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  const setPreset = (preset: DatePreset) => {
    if (preset === "custom") {
      const r = resolveDateRange(value);
      onChange({
        preset,
        customInicio: value.customInicio || r.dataInicio || toDateInputValue(new Date()),
        customFim: value.customFim || r.dataFim || toDateInputValue(new Date()),
      });
      return;
    }
    onChange({ ...value, preset });
    if (preset !== value.preset) setOpen(false);
  };

  const handleDayClick = (day: Date) => {
    const clicked = toDateInputValue(day);
    if (!startSelected || (startSelected && endSelected)) {
      onChange({ preset: "custom", customInicio: clicked, customFim: "" });
      return;
    }
    if (day < startSelected) {
      onChange({ preset: "custom", customInicio: clicked, customFim: toDateInputValue(startSelected) });
      return;
    }
    onChange({ preset: "custom", customInicio: value.customInicio, customFim: clicked });
  };

  const isInRange = (day: Date) => Boolean(startSelected && endSelected && day >= startSelected && day <= endSelected);
  const customActive = value.preset === "custom";
  const leftMonth = visibleMonth;
  const rightMonth = new Date(visibleMonth.getFullYear(), visibleMonth.getMonth() + 1, 1);
  const presets: Array<[DatePreset, string]> = allowAll ? [["all", "Todo o período"], ...PRESET_OPTIONS] : PRESET_OPTIONS;

  const toolbarLabel =
    value.preset === "all"
      ? "Todo o período"
      : customActive && resolved.dataInicio
        ? `${formatDateShort(resolved.dataInicio)} – ${formatDateShort(resolved.dataFim)}`
        : presets.find(([p]) => p === value.preset)?.[1] ?? resolved.label;
  const panelLabelFull =
    customActive && value.customInicio && value.customFim
      ? `Personalizado: ${formatDatePt(value.customInicio)} a ${formatDatePt(value.customFim)}`
      : `${resolved.label}: ${formatDatePt(resolved.dataInicio)} a ${formatDatePt(resolved.dataFim)}`;

  return (
    <div ref={rootRef} className={cn("relative", className)}>
      {variant === "panel" ? (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          onClick={() => setOpen((v) => !v)}
          className="date-range-trigger inline-flex items-center gap-2 rounded-xl border border-[var(--border)] bg-[var(--card)] px-3 py-2.5 type-fine-print transition active:scale-95 sm:gap-2.5 sm:px-4"
        >
          <CalendarDays className="h-4 w-4 shrink-0 text-[var(--primary)]" />
          <span className="min-w-0 truncate text-[var(--foreground)]">
            <span className="sm:hidden">{resolved.label}</span>
            <span className="hidden max-w-[280px] truncate sm:inline">{panelLabelFull}</span>
          </span>
          <SlidersHorizontal className="h-3.5 w-3.5 shrink-0 text-[var(--muted-foreground)]" />
        </button>
      ) : (
        <button
          ref={triggerRef}
          type="button"
          aria-haspopup="dialog"
          aria-expanded={open}
          aria-label={`Período: ${resolved.label}`}
          data-open={open ? "true" : "false"}
          onClick={() => setOpen((v) => !v)}
          className="date-range-trigger pill-select-trigger type-caption"
        >
          <span className="flex min-w-0 flex-1 items-center gap-2">
            <CalendarDays className="h-3.5 w-3.5 shrink-0 text-[var(--primary)]" strokeWidth={1.75} />
            <span className={cn("truncate", value.preset === "all" && "pill-select-label-muted")}>{toolbarLabel}</span>
          </span>
          <ChevronDown
            className={cn("h-3.5 w-3.5 shrink-0 text-[var(--ink-muted-48)] transition", open && "rotate-180")}
            strokeWidth={1.75}
          />
        </button>
      )}

      {open && isMobile ? (
        <div className="date-range-backdrop" aria-hidden onClick={() => setOpen(false)} />
      ) : null}
      {open && pos ? (
        <div
          role="dialog"
          aria-label="Escolher período"
          className={
            isMobile
              ? "date-range-sheet"
              : "fixed z-50 overflow-hidden rounded-2xl border border-[var(--border)] bg-[var(--card)]"
          }
          style={isMobile ? undefined : { top: pos.top, left: pos.left, width: pos.width }}
        >
          <div className="grid md:grid-cols-[220px_1fr]">
            <div className="border-b border-[var(--border)] p-3 md:border-b-0 md:border-r">
              <p className="mb-2 px-3 type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
                Períodos
              </p>
              <div className="date-range-presets space-y-0.5">
                {presets.map(([preset, label]) => {
                  const active = value.preset === preset;
                  return (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setPreset(preset)}
                      className={cn(
                        "flex w-full items-center justify-between rounded-[var(--radius-xs)] px-3 py-1.5 text-left transition active:scale-[0.99]",
                        active
                          ? "bg-[var(--primary-glow)] type-caption-strong text-[var(--primary)]"
                          : "type-caption text-[var(--foreground)] hover:bg-[var(--canvas-parchment)]",
                      )}
                    >
                      <span>{label}</span>
                      <span
                        className={cn("h-2 w-2 rounded-full", active ? "bg-[var(--primary)]" : "bg-[var(--border)]")}
                      />
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="p-4">
              <div className="mb-3 flex items-center justify-between">
                <button
                  type="button"
                  aria-label="Mês anterior"
                  onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() - 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--border)] text-[var(--muted-foreground)] transition active:scale-95"
                >
                  <ChevronLeft className="h-4 w-4" />
                </button>
                <p className="type-fine-print text-[var(--muted-foreground)]">
                  {value.preset === "all"
                    ? "Todo o período"
                    : `${formatDatePt(customActive ? value.customInicio : resolved.dataInicio)} a ${formatDatePt(
                        customActive ? value.customFim : resolved.dataFim,
                      )}`}
                </p>
                <button
                  type="button"
                  aria-label="Próximo mês"
                  onClick={() => setVisibleMonth((prev) => new Date(prev.getFullYear(), prev.getMonth() + 1, 1))}
                  className="flex h-8 w-8 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--border)] text-[var(--muted-foreground)] transition active:scale-95"
                >
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>

              <div className="grid gap-4 lg:grid-cols-2">
                {[leftMonth, rightMonth].map((monthDate, idx) => {
                  const grid = buildMonthGrid(monthDate);
                  return (
                    <div
                      key={`${monthDate.getFullYear()}-${monthDate.getMonth()}`}
                      className={cn("rounded-xl border border-[var(--border)] p-3", idx === 0 && "hidden lg:block")}
                    >
                      <p className="mb-2 type-caption-strong capitalize text-[var(--foreground)]">
                        {monthDate.toLocaleDateString("pt-BR", { month: "long", year: "numeric" })}
                      </p>
                      <div className="mb-1 grid grid-cols-7 text-center type-fine-print uppercase text-[var(--muted-foreground)]">
                        {["Seg", "Ter", "Qua", "Qui", "Sex", "Sab", "Dom"].map((d) => (
                          <span key={d}>{d}</span>
                        ))}
                      </div>
                      <div className="grid grid-cols-7 gap-0.5">
                        {grid.map((day, i) => {
                          if (!day) return <span key={i} className="h-8" />;
                          const edge =
                            customActive &&
                            ((startSelected && isSameDay(day, startSelected)) || (endSelected && isSameDay(day, endSelected)));
                          const inRange = customActive && isInRange(day);
                          return (
                            <button
                              key={toDateInputValue(day)}
                              type="button"
                              onClick={() => handleDayClick(day)}
                              className={cn(
                                "h-8 rounded-[var(--radius-xs)] type-fine-print tabular-nums transition",
                                edge
                                  ? "bg-[var(--primary)] text-[var(--on-primary)]"
                                  : inRange
                                    ? "bg-[var(--primary-glow)] text-[var(--primary)]"
                                    : "text-[var(--foreground)] hover:bg-[var(--canvas-parchment)]",
                              )}
                            >
                              {day.getDate()}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="date-range-footer mt-4 flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] pt-3">
                <div className="flex gap-2">
                  <input
                    type="date"
                    aria-label="Data inicial"
                    value={value.customInicio}
                    onChange={(e) => onChange({ ...value, preset: "custom", customInicio: e.target.value })}
                    className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-1.5 type-caption"
                  />
                  <input
                    type="date"
                    aria-label="Data final"
                    value={value.customFim}
                    onChange={(e) => onChange({ ...value, preset: "custom", customFim: e.target.value })}
                    className="rounded-[var(--radius-xs)] border border-[var(--border)] bg-[var(--canvas)] px-3 py-1.5 type-caption"
                  />
                </div>
                <Button type="button" variant="primary" size="toolbar" onClick={() => setOpen(false)}>
                  Aplicar
                </Button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
