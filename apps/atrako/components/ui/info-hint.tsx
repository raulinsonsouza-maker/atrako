"use client";

import { useEffect, useRef, useState } from "react";
import { Info } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Explicação sob demanda (YAML `info-hint`): ícone "i" ao lado do título abre um balão curto.
 * Tira parágrafos de ajuda da tela sem perder a informação.
 */
export function InfoHint({
  children,
  align = "start",
  label = "Saiba mais",
  className,
}: {
  children: React.ReactNode;
  /** Lado de ancoragem do balão — `end` para ícones perto da borda direita. */
  align?: "start" | "end";
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("mousedown", onDoc);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDoc);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <span ref={ref} className={cn("info-hint", className)}>
      <button
        type="button"
        className="info-hint-trigger"
        aria-label={label}
        aria-expanded={open}
        data-open={open ? "true" : "false"}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((v) => !v);
        }}
      >
        <Info className="h-3.5 w-3.5" strokeWidth={1.75} />
      </button>
      {open ? (
        <span role="tooltip" className="info-hint-pop type-fine-print" data-align={align}>
          {children}
        </span>
      ) : null}
    </span>
  );
}
