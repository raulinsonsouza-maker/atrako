"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "motion/react";
import { prefersReducedMotion, useFxText } from "../host";

export function TextRotate({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  const words = (el.dataset.words || text).split("|").map((s) => s.trim()).filter(Boolean);
  const [i, setI] = useState(0);
  useEffect(() => {
    if (!ready || words.length < 2 || prefersReducedMotion()) return;
    const timer = setInterval(() => setI((n) => (n + 1) % words.length), 2200);
    return () => clearInterval(timer);
  }, [ready, words.length]);
  if (!ready || !words.length) return null;
  if (prefersReducedMotion() || words.length < 2) return createPortal(<span>{words[0]}</span>, el);
  return createPortal(
    <span style={{ display: "inline-grid" }}>
      <AnimatePresence mode="wait">
        <motion.span
          key={words[i]}
          initial={{ y: 8, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -8, opacity: 0 }}
          transition={{ duration: 0.28 }}
          style={{ gridArea: "1 / 1" }}
        >
          {words[i]}
        </motion.span>
      </AnimatePresence>
    </span>,
    el,
  );
}
