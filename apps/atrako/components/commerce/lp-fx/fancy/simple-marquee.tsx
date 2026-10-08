"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { useEffect } from "react";
import { prefersReducedMotion } from "../host";

export function SimpleMarquee({ el }: { el: HTMLElement }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    el.classList.add("fx-marquee");
    const track = document.createElement("div");
    track.className = "fx-marquee-track";
    const kids = [...el.childNodes];
    for (const node of kids) track.appendChild(node);
    const clone = track.cloneNode(true) as HTMLElement;
    clone.setAttribute("aria-hidden", "true");
    for (const node of [...clone.childNodes]) track.appendChild(node);
    el.appendChild(track);
    return () => {
      el.classList.remove("fx-marquee");
      if (!el.contains(track)) return;
      const half = Math.floor(track.childNodes.length / 2);
      const originals = [...track.childNodes].slice(0, half);
      el.removeChild(track);
      for (const node of originals) el.appendChild(node);
    };
  }, [el]);
  return null;
}
