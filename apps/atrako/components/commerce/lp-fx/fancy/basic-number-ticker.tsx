"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { animate } from "motion/react";
import { prefersReducedMotion, useFxText } from "../host";

export function NumberTicker({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  const target = Number(el.dataset.value ?? text.replace(/\D/g, "") ?? "0");
  const [value, setValue] = useState(prefersReducedMotion() ? target : 0);
  useEffect(() => {
    if (!ready || prefersReducedMotion() || !Number.isFinite(target)) return;
    const controls = animate(0, target, {
      duration: 1.2,
      ease: "easeOut",
      onUpdate: (v) => setValue(Math.round(v)),
    });
    return () => controls.stop();
  }, [ready, target]);
  if (!ready) return null;
  const formatted = Number.isFinite(target) ? value.toLocaleString("pt-BR") : text;
  return createPortal(<span>{formatted}</span>, el);
}
