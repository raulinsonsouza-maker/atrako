"use client";

import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

interface PageHeaderContextValue {
  summary?: string;
  subtitle?: string;
  setSummary: (s: string | undefined) => void;
  setSubtitle: (s: string | undefined) => void;
}

const PageHeaderContext = createContext<PageHeaderContextValue | null>(null);

export function PageHeaderProvider({ children }: { children: ReactNode }) {
  const [summary, setSummaryState] = useState<string | undefined>(undefined);
  const [subtitle, setSubtitleState] = useState<string | undefined>(undefined);
  const setSummary = useCallback((s: string | undefined) => setSummaryState(s), []);
  const setSubtitle = useCallback((s: string | undefined) => setSubtitleState(s), []);

  return (
    <PageHeaderContext.Provider value={{ summary, subtitle, setSummary, setSubtitle }}>
      {children}
    </PageHeaderContext.Provider>
  );
}

export function usePageHeader(): PageHeaderContextValue {
  const ctx = useContext(PageHeaderContext);
  if (!ctx) {
    return {
      summary: undefined,
      subtitle: undefined,
      setSummary: () => {},
      setSubtitle: () => {},
    };
  }
  return ctx;
}
