"use client";

import { useEffect, useState } from "react";
import { resolveDateRange, type DateRangeValue } from "@/components/ui/date-range-filter";

const STORAGE_KEY = "atrako-atendimento-period";
const DEFAULT: DateRangeValue = { preset: "30d", customInicio: "", customFim: "" };

/** Período único da área do cliente (Início e Financeiro), lembrado no navegador. */
export function useAtendimentoPeriod() {
  const [value, setValue] = useState<DateRangeValue>(DEFAULT);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as DateRangeValue | null;
      if (saved?.preset && saved.preset !== "all") setValue(saved);
    } catch {
      /* valor corrompido: fica nos últimos 30 dias */
    }
  }, []);

  function change(next: DateRangeValue) {
    setValue(next);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }

  const resolved = resolveDateRange(value);
  const params = new URLSearchParams();
  if (resolved.periodo) params.set("periodo", resolved.periodo);
  if (resolved.dataInicio) params.set("dataInicio", resolved.dataInicio);
  if (resolved.dataFim) params.set("dataFim", resolved.dataFim);

  return { value, change, resolved, query: params.toString(), periodo: resolved.periodo ?? "30" };
}
