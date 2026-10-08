"use client";

import { useEffect, useState } from "react";

export function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Esvazia o texto do elemento para o portal ocupar o lugar. Restaura ao desmontar. */
export function useFxHost(el: HTMLElement) {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const original = el.innerHTML;
    el.textContent = "";
    setReady(true);
    return () => {
      if (el.isConnected) el.innerHTML = original;
    };
  }, [el]);
  return ready;
}

/** Lê o texto uma vez, antes do host apagar o conteúdo. */
export function useFxText(el: HTMLElement) {
  const [text] = useState(() => (el.textContent || "").replace(/\s+/g, " ").trim());
  const ready = useFxHost(el);
  return { text, ready };
}
