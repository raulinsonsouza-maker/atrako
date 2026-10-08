"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { motion } from "motion/react";
import { prefersReducedMotion, useFxText } from "../host";

export function TextHighlighter({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  const [on, setOn] = useState(prefersReducedMotion());
  useEffect(() => {
    if (!ready || prefersReducedMotion()) return;
    const io = new IntersectionObserver(([entry]) => {
      if (entry?.isIntersecting) setOn(true);
    }, { threshold: 0.6 });
    io.observe(el);
    return () => io.disconnect();
  }, [el, ready]);
  if (!ready) return null;
  return createPortal(
    <span style={{ position: "relative", display: "inline" }}>
      <motion.span
        aria-hidden
        initial={{ scaleX: on ? 1 : 0 }}
        animate={{ scaleX: on ? 1 : 0 }}
        transition={{ duration: 0.45 }}
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          bottom: "0.08em",
          height: "0.42em",
          transformOrigin: "left",
          background: "color-mix(in srgb, var(--primary, #0066cc) 35%, transparent)",
          zIndex: 0,
        }}
      />
      <span style={{ position: "relative" }}>{text}</span>
    </span>,
    el,
  );
}
