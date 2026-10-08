"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { createPortal } from "react-dom";
import { motion } from "motion/react";
import { prefersReducedMotion, useFxText } from "../host";

export function LetterSwap({ el }: { el: HTMLElement }) {
  const { text, ready } = useFxText(el);
  if (!ready) return null;
  if (prefersReducedMotion()) return createPortal(<span>{text}</span>, el);
  return createPortal(
    <span
      style={{ display: "inline-flex" }}
      onMouseEnter={(event) => {
        event.currentTarget.querySelectorAll("span").forEach((node, i) => {
          (node as HTMLElement).animate(
            [{ transform: "translateY(0)" }, { transform: "translateY(-3px)" }, { transform: "translateY(0)" }],
            { duration: 280, delay: i * 18 },
          );
        });
      }}
    >
      {text.split("").map((ch, i) => (
        <motion.span key={`${ch}-${i}`} style={{ display: "inline-block", whiteSpace: "pre" }}>
          {ch}
        </motion.span>
      ))}
    </span>,
    el,
  );
}
