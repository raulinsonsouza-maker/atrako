"use client";

// Adaptado de Fancy Components (MIT) — Daniel Petho — https://github.com/danielpetho/fancy

import { useEffect } from "react";
import { prefersReducedMotion } from "../host";

export function Float({ el }: { el: HTMLElement }) {
  useEffect(() => {
    if (prefersReducedMotion()) return;
    const anim = el.animate(
      [{ transform: "translateY(0)" }, { transform: "translateY(-10px)" }, { transform: "translateY(0)" }],
      { duration: 3600, iterations: Infinity, easing: "ease-in-out" },
    );
    return () => anim.cancel();
  }, [el]);
  return null;
}
