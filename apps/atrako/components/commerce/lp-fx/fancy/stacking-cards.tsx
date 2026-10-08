"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { useEffect } from "react";
import { prefersReducedMotion } from "../host";

export function StackingCards({ el }: { el: HTMLElement }) {
  useEffect(() => {
    const cards = [...el.querySelectorAll<HTMLElement>("[data-fx-card]")];
    if (prefersReducedMotion() || cards.length < 2) return;
    cards.forEach((card, i) => {
      card.style.position = "sticky";
      card.style.top = `${72 + i * 12}px`;
    });
    return () => {
      for (const card of cards) {
        card.style.position = "";
        card.style.top = "";
      }
    };
  }, [el]);
  return null;
}
