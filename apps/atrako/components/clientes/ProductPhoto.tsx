"use client";

import { useState } from "react";
import { ShoppingBag } from "lucide-react";

export function ProductPhoto({ src, size = "md" }: { src: string | null; size?: "sm" | "md" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "h-12 w-12" : "h-16 w-16";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  if (!src || failed) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] text-[var(--muted-foreground)]`}>
        <ShoppingBag className={icon} strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] shadow-product`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
    </span>
  );
}
