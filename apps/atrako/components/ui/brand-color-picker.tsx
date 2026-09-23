"use client";

import { useMemo } from "react";
import { cn } from "@/lib/utils";
import {
  DEFAULT_PRIMARY,
  normalizePrimaryHex,
  resolveBrandPrimaryVars,
} from "@/lib/brand/primaryColor";

const PRESETS = [
  "#0066cc",
  "#0071e3",
  "#1d1d1f",
  "#34c759",
  "#ff9500",
  "#af52de",
  "#ff2d55",
  "#5856d6",
];

type Props = {
  value: string;
  onChange: (hex: string) => void;
  brandName?: string;
  className?: string;
};

export function BrandColorPicker({ value, onChange, brandName = "Sua marca", className }: Props) {
  const hex = normalizePrimaryHex(value) ?? DEFAULT_PRIMARY;
  const vars = useMemo(() => resolveBrandPrimaryVars(hex), [hex]);

  return (
    <div className={cn("space-y-4", className)}>
      <div
        className="overflow-hidden rounded-lg"
        style={{ background: vars.primary }}
      >
        <div className="flex min-h-[120px] flex-col justify-end p-6 text-white sm:min-h-[132px]">
          <p className="type-display-lg text-white">{brandName || "Sua marca"}</p>
          <div className="mt-4 flex items-center gap-3">
            <span
              className="inline-flex rounded-[var(--radius-xs)] bg-white/95 px-4 py-2 type-caption-strong"
              style={{ color: vars.primary }}
            >
              Comprar
            </span>
            <span className="type-caption text-white/90">Saiba mais</span>
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <label className="relative h-12 w-12 shrink-0 cursor-pointer overflow-hidden rounded-full border border-[var(--hairline)] active:scale-95">
          <span className="sr-only">Escolher cor</span>
          <span className="absolute inset-0" style={{ background: hex }} />
          <input
            type="color"
            value={hex}
            onChange={(e) => {
              const n = normalizePrimaryHex(e.target.value);
              if (n) onChange(n);
            }}
            className="absolute inset-0 cursor-pointer opacity-0"
          />
        </label>

        {PRESETS.map((p) => (
          <button
            key={p}
            type="button"
            aria-label={p}
            aria-pressed={hex === p}
            onClick={() => onChange(p)}
            className={cn(
              "h-9 w-9 rounded-full transition active:scale-95",
              hex === p ? "ring-2 ring-[var(--primary-focus)] ring-offset-2" : "ring-1 ring-[var(--hairline)]"
            )}
            style={{ background: p }}
          />
        ))}

        <input
          type="text"
          spellCheck={false}
          aria-label="Hex"
          className="h-11 w-[7.5rem] rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 font-mono type-caption uppercase text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-[var(--primary-focus)]"
          value={value || hex}
          onChange={(e) => onChange(e.target.value)}
          onBlur={() => onChange(normalizePrimaryHex(value) ?? DEFAULT_PRIMARY)}
        />
      </div>
    </div>
  );
}
