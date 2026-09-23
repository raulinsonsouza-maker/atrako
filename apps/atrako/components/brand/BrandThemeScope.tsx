"use client";

import { useEffect, useRef } from "react";
import { applyBrandPrimaryToElement } from "@/lib/brand/primaryColor";

/** Aplica cor de marca num wrapper (LP / checkout públicos). */
export function BrandThemeScope({
  primaryColor,
  children,
  className,
}: {
  primaryColor?: string | null;
  children: React.ReactNode;
  className?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ref.current) return;
    applyBrandPrimaryToElement(ref.current, primaryColor);
  }, [primaryColor]);

  return (
    <div ref={ref} className={className}>
      {children}
    </div>
  );
}
