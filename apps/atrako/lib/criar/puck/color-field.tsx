"use client";

import {
  DEFAULT_PRIMARY,
  normalizePrimaryHex,
} from "@/lib/brand/primaryColor";

/** Legacy surface tokens → hex (páginas antigas). */
export const SURFACE_HEX: Record<string, string> = {
  parchment: "#f5f5f7",
  canvas: "#ffffff",
  brand: DEFAULT_PRIMARY,
  ink: "#1d1d1f",
};

export function resolveBg(
  bgColor: string | undefined,
  surface?: string,
  fallback = "#f5f5f7",
) {
  const fromPicker = normalizePrimaryHex(bgColor);
  if (fromPicker) return fromPicker;
  if (surface && SURFACE_HEX[surface]) return SURFACE_HEX[surface];
  return fallback;
}

export function isDarkHex(hex: string) {
  const n = normalizePrimaryHex(hex);
  if (!n) return false;
  const v = parseInt(n.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  return (0.299 * r + 0.587 * g + 0.114 * b) / 255 < 0.55;
}

/** Contraste automático — texto claro/escuro a partir do fundo. */
export function contrastInk(bg: string, light = "#ffffff", dark = "#1d1d1f") {
  return isDarkHex(bg) ? light : dark;
}

type ColorFieldProps = {
  label: string;
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function LpColorFieldInput({
  label,
  value,
  onChange,
  readOnly,
}: ColorFieldProps) {
  const hex = normalizePrimaryHex(value) ?? "#ffffff";

  if (readOnly) {
    return (
      <div className="lp-color-field">
        <span className="lp-color-field-label">{label}</span>
        <span
          className="lp-color-field-swatch"
          style={{ background: hex }}
          aria-hidden
        />
        <span className="lp-color-field-hex-ro">{hex.toUpperCase()}</span>
      </div>
    );
  }

  return (
    <div className="lp-color-field">
      <span className="lp-color-field-label">{label}</span>
      <label className="lp-color-field-swatch" style={{ background: hex }}>
        <input
          type="color"
          value={hex}
          aria-label={label}
          onChange={(e) => {
            const n = normalizePrimaryHex(e.target.value);
            if (n) onChange(n);
          }}
        />
      </label>
      <input
        type="text"
        className="lp-color-field-hex"
        spellCheck={false}
        value={(value || hex).toUpperCase()}
        onChange={(e) => onChange(e.target.value)}
        onBlur={() => onChange(normalizePrimaryHex(value) ?? hex)}
        aria-label={`${label} hex`}
        placeholder="#000000"
      />
    </div>
  );
}

/** Custom field — rótulo inline (Puck não rotula `type: custom`). */
export function colorField(label: string) {
  return {
    type: "custom" as const,
    label,
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value: string;
      onChange: (v: string) => void;
      readOnly?: boolean;
    }) => (
      <LpColorFieldInput
        label={label}
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        readOnly={readOnly}
      />
    ),
  };
}
