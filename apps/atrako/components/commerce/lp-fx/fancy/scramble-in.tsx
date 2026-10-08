"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { useEffect, useState } from "react";
import { prefersReducedMotion, useFxText } from "../host";

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";

export function ScrambleIn({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  const [shown, setShown] = useState(text);
  useEffect(() => {
    if (!ready || prefersReducedMotion() || !text) return;
    let frame = 0;
    const timer = setInterval(() => {
      frame += 1;
      const done = Math.floor((frame / 16) * text.length);
      const rest = text
        .slice(done)
        .split("")
        .map((ch) => (ch === " " ? " " : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]))
        .join("");
      setShown(text.slice(0, done) + rest);
      if (done >= text.length) clearInterval(timer);
    }, 40);
    return () => clearInterval(timer);
  }, [ready, text]);
  if (!ready) return null;
  return createPortal(<span>{shown}</span>, el);
}
