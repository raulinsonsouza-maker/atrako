"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { prefersReducedMotion, useFxText } from "../host";

export function CutReveal({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  if (!ready) return null;
  if (prefersReducedMotion()) return createPortal(<span>{text}</span>, el);
  return createPortal(
    <motion.span
      initial={{ clipPath: "inset(0 100% 0 0)" }}
      animate={{ clipPath: "inset(0 0% 0 0)" }}
      transition={{ duration: 0.7, ease: "easeOut" }}
      style={{ display: "inline-block" }}
    >
      {text}
    </motion.span>,
    el,
  );
}
