"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { prefersReducedMotion, useFxText } from "../host";

export function Typewriter({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  const [n, setN] = useState(prefersReducedMotion() ? text.length : 0);
  useEffect(() => {
    if (!ready || prefersReducedMotion()) return;
    const timer = setInterval(() => {
      setN((v) => {
        if (v >= text.length) {
          clearInterval(timer);
          return v;
        }
        return v + 1;
      });
    }, 36);
    return () => clearInterval(timer);
  }, [ready, text]);
  if (!ready) return null;
  return createPortal(<span>{text.slice(0, n)}</span>, el);
}
