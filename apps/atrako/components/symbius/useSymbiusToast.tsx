"use client";

import { useCallback, useEffect, useState } from "react";

type ToastKind = "success" | "error" | "info";

type ToastState = {
  message: string;
  kind: ToastKind;
} | null;

/** Toast leve para Settings/wizards — sem dependência externa. */
export function useSymbiusToast() {
  const [toast, setToast] = useState<ToastState>(null);

  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 3500);
    return () => window.clearTimeout(t);
  }, [toast]);

  const show = useCallback((message: string, kind: ToastKind = "info") => {
    setToast({ message, kind });
  }, []);

  const Toast = toast ? (
    <div
      role="status"
      className={`fixed bottom-4 right-4 z-[100] max-w-sm rounded-xl px-4 py-3 text-sm font-medium shadow-lg ${
        toast.kind === "success"
          ? "bg-emerald-600 text-white"
          : toast.kind === "error"
            ? "bg-red-600 text-white"
            : "bg-zinc-900 text-white"
      }`}
    >
      {toast.message}
    </div>
  ) : null;

  return { show, Toast };
}

export async function fetchJson(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<{ ok: boolean; data: Record<string, unknown>; status: number }> {
  const res = await fetch(input, init);
  let data: Record<string, unknown> = {};
  try {
    data = (await res.json()) as Record<string, unknown>;
  } catch {
    data = {};
  }
  return { ok: res.ok, data, status: res.status };
}
