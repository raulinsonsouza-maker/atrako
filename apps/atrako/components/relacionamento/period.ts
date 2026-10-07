"use client";

import { useEffect, useState } from "react";
import { resolveDateRange, type DateRangeValue } from "@/components/ui";

const STORAGE_KEY = "rel-date-range";
const DEFAULT_RANGE: DateRangeValue = { preset: "30d", customInicio: "", customFim: "" };

export type RelPeriod = {
  /** `dataInicio=…&dataFim=…` pronto para a query string das APIs. */
  qs: string;
  dataInicio: string;
  dataFim: string;
  label: string;
};

export function relPeriod(dataInicio: string, dataFim: string, label: string): RelPeriod {
  return { qs: new URLSearchParams({ dataInicio, dataFim }).toString(), dataInicio, dataFim, label };
}

/** Janela fixa (telas de operação não têm filtro de data). */
export function lastDaysPeriod(days = 30): RelPeriod {
  const r = resolveDateRange({ preset: `${days}d` as DateRangeValue["preset"], customInicio: "", customFim: "" });
  return relPeriod(r.dataInicio ?? "", r.dataFim ?? "", r.label);
}

/** Período único do Relacionamento — mesmo filtro do CRM/dashboard, lembrado no navegador. */
export function useRelPeriod() {
  const [value, setValue] = useState<DateRangeValue>(DEFAULT_RANGE);

  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? "null") as DateRangeValue | null;
      if (saved?.preset && saved.preset !== "all") setValue(saved);
    } catch {
      /* valor antigo/corrompido: fica nos últimos 30 dias */
    }
  }, []);

  const change = (v: DateRangeValue) => {
    setValue(v);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(v));
  };

  const r = resolveDateRange(value);
  const dataInicio = r.dataInicio ?? "";
  const dataFim = r.dataFim ?? "";
  const period: RelPeriod = {
    qs: new URLSearchParams({ dataInicio, dataFim }).toString(),
    dataInicio,
    dataFim,
    label: r.label,
  };
  return { value, change, period };
}
