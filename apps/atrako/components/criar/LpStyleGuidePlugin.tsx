"use client";

import { useMemo, useState, type CSSProperties, type ReactNode } from "react";
import { usePuck, type Plugin } from "@puckeditor/core";
import { Palette } from "lucide-react";
import {
  DEFAULT_PRIMARY,
  normalizePrimaryHex,
  resolveBrandPrimaryVars,
} from "@/lib/brand/primaryColor";

type StyleTab = "cores" | "tipos" | "estilos";

const SURFACE_SWATCHES: Array<{
  key: string;
  label: string;
  varName: string;
  fallback: string;
}> = [
  { key: "bg", label: "Background", varName: "--canvas-parchment", fallback: "#f5f5f7" },
  { key: "card", label: "Card", varName: "--canvas", fallback: "#ffffff" },
  { key: "soft", label: "Soft", varName: "--ink-muted-48", fallback: "#7a7a7a" },
];

const TEXT_SWATCHES: Array<{
  key: string;
  label: string;
  color: string;
  on?: string;
}> = [
  { key: "light", label: "Light", color: "#ffffff", on: "#1d1d1f" },
  { key: "dark", label: "Dark", color: "#1d1d1f", on: "#ffffff" },
];

function readCssVar(name: string, fallback: string) {
  if (typeof window === "undefined") return fallback;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || fallback;
}

function ColorRow({
  label,
  hex,
  editable,
  onChange,
}: {
  label: string;
  hex: string;
  editable?: boolean;
  onChange?: (hex: string) => void;
}) {
  return (
    <div className="lp-sg-color-row">
      <div
        className="lp-sg-swatch"
        style={{ background: hex }}
        data-light={hex.toLowerCase() === "#ffffff" ? "true" : undefined}
      >
        <span className="lp-sg-swatch-aa" style={{ color: contrastingInk(hex) }}>
          Aa
        </span>
      </div>
      <div className="lp-sg-color-meta">
        <p className="lp-sg-color-label type-caption-strong">{label}</p>
        {editable && onChange ? (
          <label className="lp-sg-hex-edit">
            <span className="sr-only">Cor {label}</span>
            <input
              type="color"
              value={normalizePrimaryHex(hex) ?? DEFAULT_PRIMARY}
              onChange={(e) => {
                const n = normalizePrimaryHex(e.target.value);
                if (n) onChange(n);
              }}
            />
            <input
              type="text"
              spellCheck={false}
              className="lp-sg-hex-input"
              value={hex.toUpperCase()}
              onChange={(e) => onChange(e.target.value)}
              onBlur={() =>
                onChange(normalizePrimaryHex(hex) ?? DEFAULT_PRIMARY)
              }
            />
          </label>
        ) : (
          <p className="lp-sg-hex type-micro-legal">{hex.toUpperCase()}</p>
        )}
      </div>
    </div>
  );
}

function contrastingInk(hex: string) {
  const n = normalizePrimaryHex(hex);
  if (!n) return "#1d1d1f";
  const v = parseInt(n.slice(1), 16);
  const r = (v >> 16) & 255;
  const g = (v >> 8) & 255;
  const b = v & 255;
  const lum = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return lum > 0.62 ? "#1d1d1f" : "#ffffff";
}

function StyleGuidePanel() {
  const { appState, dispatch } = usePuck();
  const [tab, setTab] = useState<StyleTab>("cores");

  const rootProps = (appState.data.root as { props?: Record<string, unknown> })
    ?.props;
  const stored =
    typeof rootProps?.primaryColor === "string" ? rootProps.primaryColor : "";
  const primary = normalizePrimaryHex(stored) ?? DEFAULT_PRIMARY;
  const brand = useMemo(() => resolveBrandPrimaryVars(primary), [primary]);

  const surfaces = useMemo(
    () =>
      SURFACE_SWATCHES.map((s) => ({
        ...s,
        hex: readCssVar(s.varName, s.fallback),
      })),
    [],
  );

  function setPrimary(hex: string) {
    const next = normalizePrimaryHex(hex) ?? DEFAULT_PRIMARY;
    dispatch({
      type: "setData",
      data: (previous) => {
        const prevRoot = previous.root as
          | { props?: Record<string, unknown>; [k: string]: unknown }
          | undefined;
        return {
          ...previous,
          root: {
            ...prevRoot,
            props: {
              ...(prevRoot?.props ?? {}),
              primaryColor: next,
            },
          },
        } as typeof previous;
      },
    });
  }

  return (
    <div className="lp-sg">
      <header className="lp-sg-head">
        <p className="lp-sg-kicker type-micro-legal">Style guide</p>
        <h2 className="lp-sg-title type-caption-strong">Identidade da página</h2>
      </header>

      <div className="lp-sg-tabs" role="tablist" aria-label="Style guide">
        {(
          [
            ["cores", "Cores"],
            ["tipos", "Tipografia"],
            ["estilos", "Estilos"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            className="lp-sg-tab"
            data-active={tab === id ? "true" : undefined}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="lp-sg-body">
        {tab === "cores" ? (
          <div className="lp-sg-section">
            <p className="lp-sg-section-title type-micro-legal">Main colors</p>
            <div className="lp-sg-stack">
              <ColorRow
                label="Primary"
                hex={brand.primary}
                editable
                onChange={setPrimary}
              />
              <ColorRow label="Secondary" hex="#1d1d1f" />
              <ColorRow label="Accent" hex={brand.primaryOnDark} />
            </div>

            <p className="lp-sg-section-title type-micro-legal">Surface colors</p>
            <div className="lp-sg-stack">
              {surfaces.map((s) => (
                <ColorRow key={s.key} label={s.label} hex={s.hex} />
              ))}
            </div>

            <p className="lp-sg-section-title type-micro-legal">Text colors</p>
            <div className="lp-sg-stack">
              {TEXT_SWATCHES.map((s) => (
                <ColorRow key={s.key} label={s.label} hex={s.color} />
              ))}
            </div>
          </div>
        ) : null}

        {tab === "tipos" ? (
          <div className="lp-sg-section">
            <p className="lp-sg-section-title type-micro-legal">Headings</p>
            <div className="lp-sg-type-card">
              <p className="lp-sg-type-meta type-micro-legal">
                Heading 1 · Inter · 40px · Semibold (600)
              </p>
              <p className="lp-sg-type-h1">The quick brown fox jumps</p>
            </div>
            <div className="lp-sg-type-card">
              <p className="lp-sg-type-meta type-micro-legal">
                Heading 2 · Inter · 28px · Semibold (600)
              </p>
              <p className="lp-sg-type-h2">The quick brown fox jumps</p>
            </div>
            <div className="lp-sg-type-card">
              <p className="lp-sg-type-meta type-micro-legal">
                Body · Inter · 17px · Regular (400)
              </p>
              <p className="lp-sg-type-body">
                Descreva o benefício principal em uma ou duas frases claras.
              </p>
            </div>
            <div className="lp-sg-type-card">
              <p className="lp-sg-type-meta type-micro-legal">
                Caption · Inter · 14px · Semibold (600)
              </p>
              <p className="lp-sg-type-caption">Pergunta do FAQ · CTA</p>
            </div>
          </div>
        ) : null}

        {tab === "estilos" ? (
          <div className="lp-sg-section">
            <p className="lp-sg-section-title type-micro-legal">Components</p>
            <div className="lp-sg-preview-card">
              <p className="lp-sg-type-meta type-micro-legal">Botão CTA</p>
              <span className="lp-cta" style={{ pointerEvents: "none" }}>
                Quero começar
              </span>
            </div>
            <div className="lp-sg-preview-card">
              <p className="lp-sg-type-meta type-micro-legal">Benefício</p>
              <div className="lp-benefit-card" style={{ maxWidth: "none" }}>
                <span className="lp-benefit-mark" aria-hidden>
                  ✓
                </span>
                <span className="type-body text-[var(--ink)]">
                  Resultado claro em poucos passos
                </span>
              </div>
            </div>
            <div className="lp-sg-preview-card">
              <p className="lp-sg-type-meta type-micro-legal">Box destaque</p>
              <div
                className="lp-box-card"
                data-surface="parchment"
                style={{ margin: 0, maxWidth: "none" }}
              >
                <h3 className="type-caption-strong text-[var(--ink)]">
                  Garantia
                </h3>
                <p className="mt-2 type-body text-[var(--ink-muted-80)]">
                  Use para prova social ou garantia.
                </p>
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

/** Plugin Puck: Style guide (Cores / Tipografia / Estilos) — padrão GreatPages. */
export function createLpStyleGuidePlugin(): Plugin {
  return {
    name: "atrako-style",
    label: "Estilo",
    icon: <Palette strokeWidth={1.75} aria-hidden />,
    render: () => <StyleGuidePanel />,
  };
}

export function LpPageRoot({
  children,
  primaryColor,
}: {
  children: ReactNode;
  primaryColor?: string;
}) {
  const vars = resolveBrandPrimaryVars(primaryColor);
  return (
    <div
      className="lp-page-puck"
      style={
        {
          "--primary": vars.primary,
          "--primary-focus": vars.primaryFocus,
          "--primary-on-dark": vars.primaryOnDark,
          "--primary-strong": vars.primary,
          "--primary-glow": vars.primaryGlow,
          "--highlight": vars.highlight,
          "--ring": vars.ring,
          "--accent": vars.accent,
        } as CSSProperties
      }
    >
      {children}
    </div>
  );
}
