/**
 * Design tokens – Apple Human Interface Guidelines (macOS Sonoma)
 * 
 * Principios:
 * - Clareza: Tipografia legivel, hierarquia visual clara
 * - Deferencia: Conteudo e protagonista, UI apoia sem competir
 * - Profundidade: Camadas visuais, glassmorphism, sombras suaves
 * - Consistencia: Grid de 8pt, componentes padronizados
 */

export const tokens = {
  colors: {
    // Apple System Colors
    primary: {
      50: "#e5f2ff",
      100: "#cce5ff",
      200: "#99ccff",
      300: "#66b3ff",
      400: "#3399ff",
      500: "#007AFF", // Apple Blue
      600: "#0066d6",
      700: "#0052ad",
      800: "#003d82",
      900: "#002952",
      950: "#001a33",
    },
    accent: {
      50: "#fff0e5",
      100: "#ffe0cc",
      200: "#ffc299",
      300: "#ffa366",
      400: "#ff8533",
      500: "#FF9500", // Apple Orange
      600: "#cc7700",
      700: "#995900",
      800: "#663c00",
      900: "#331e00",
      950: "#1a0f00",
    },
    neutral: {
      // macOS Gray Scale
      50: "#f5f5f7",
      100: "#e8e8ed",
      200: "#d2d2d7",
      300: "#aeaeb2",
      400: "#8e8e93",
      500: "#636366",
      600: "#48484a",
      700: "#3a3a3c",
      800: "#2c2c2e",
      900: "#1c1c1e",
      950: "#0a0a0a",
    },
    success: {
      50: "#e8f9ed",
      100: "#d1f3db",
      500: "#34C759", // Apple Green
      600: "#2aa147",
      700: "#1f7a35",
      800: "#155223",
    },
    warning: {
      50: "#fff8e5",
      100: "#fff0cc",
      500: "#FF9500", // Apple Orange
      600: "#cc7700",
      700: "#995900",
      800: "#663c00",
    },
    error: {
      50: "#ffe5e7",
      100: "#ffccd0",
      500: "#FF3B30", // Apple Red
      600: "#d6322a",
      700: "#ad2922",
      800: "#851f1a",
    },
    // Semantic Colors
    tint: {
      purple: "#AF52DE",
      pink: "#FF2D55",
      indigo: "#5856D6",
      teal: "#5AC8FA",
      mint: "#00C7BE",
      cyan: "#32ADE6",
    },
  },

  // Grid de 8pt (base 4px)
  spacing: {
    0: "0",
    0.5: "0.125rem", // 2px
    1: "0.25rem",    // 4px
    2: "0.5rem",     // 8px
    3: "0.75rem",    // 12px
    4: "1rem",       // 16px
    5: "1.25rem",    // 20px
    6: "1.5rem",     // 24px
    8: "2rem",       // 32px
    10: "2.5rem",    // 40px
    12: "3rem",      // 48px
    16: "4rem",      // 64px
    20: "5rem",      // 80px
  },

  // Border Radius macOS
  radius: {
    none: "0",
    xs: "4px",
    sm: "6px",      // Inputs
    md: "8px",      // Buttons, Sidebar items
    lg: "10px",     // Small cards
    xl: "12px",     // Cards
    "2xl": "14px",  // Modals
    "3xl": "18px",  // Large elements
    full: "9999px",
  },

  // Sombras macOS
  shadows: {
    xs: "0 0 0 1px rgba(0, 0, 0, 0.04)",
    sm: "0 1px 3px rgba(0, 0, 0, 0.08)",
    md: "0 4px 12px rgba(0, 0, 0, 0.1)",
    lg: "0 8px 24px rgba(0, 0, 0, 0.12)",
    xl: "0 16px 48px rgba(0, 0, 0, 0.16)",
    // Sombras para elementos elevados
    card: "0 2px 8px rgba(0, 0, 0, 0.08), 0 0 0 1px rgba(0, 0, 0, 0.04)",
    dropdown: "0 4px 20px rgba(0, 0, 0, 0.15), 0 0 0 1px rgba(0, 0, 0, 0.05)",
    modal: "0 24px 80px rgba(0, 0, 0, 0.2), 0 0 0 1px rgba(0, 0, 0, 0.08)",
  },

  // Motion com easing Apple
  motion: {
    duration: {
      instant: "50ms",
      fast: "150ms",
      normal: "200ms",
      slow: "300ms",
      slower: "400ms",
    },
    ease: {
      default: "cubic-bezier(0.25, 0.1, 0.25, 1)",
      in: "cubic-bezier(0.42, 0, 1, 1)",
      out: "cubic-bezier(0, 0, 0.58, 1)",
      inOut: "cubic-bezier(0.42, 0, 0.58, 1)",
      spring: "cubic-bezier(0.175, 0.885, 0.32, 1.275)",
    },
  },

  // Tipografia: system fonts (sem dependência de Google Fonts no build)
  typography: {
    fontFamily: {
      sans: [
        "-apple-system",
        "BlinkMacSystemFont",
        "Segoe UI",
        "Roboto",
        "Helvetica Neue",
        "Helvetica",
        "Arial",
        "sans-serif",
      ],
      mono: [
        "SF Mono",
        "ui-monospace",
        "Menlo",
        "Monaco",
        "Consolas",
        "monospace",
      ],
    },
    // Escala tipografica Apple HIG
    fontSize: {
      "caption-2": ["11px", { lineHeight: "13px", letterSpacing: "0.07px" }],
      "caption-1": ["12px", { lineHeight: "16px", letterSpacing: "0px" }],
      footnote: ["13px", { lineHeight: "18px", letterSpacing: "-0.08px" }],
      subhead: ["15px", { lineHeight: "20px", letterSpacing: "-0.24px" }],
      callout: ["16px", { lineHeight: "21px", letterSpacing: "-0.32px" }],
      body: ["17px", { lineHeight: "22px", letterSpacing: "-0.43px" }],
      headline: ["17px", { lineHeight: "22px", letterSpacing: "-0.43px", fontWeight: "600" }],
      "title-3": ["20px", { lineHeight: "25px", letterSpacing: "0.38px" }],
      "title-2": ["22px", { lineHeight: "28px", letterSpacing: "0.35px" }],
      "title-1": ["28px", { lineHeight: "34px", letterSpacing: "0.36px" }],
      "large-title": ["34px", { lineHeight: "41px", letterSpacing: "0.37px" }],
    },
    fontWeight: {
      regular: "400",
      medium: "500",
      semibold: "600",
      bold: "700",
    },
  },

  // Glassmorphism
  glass: {
    light: {
      background: "rgba(255, 255, 255, 0.72)",
      backgroundSubtle: "rgba(255, 255, 255, 0.6)",
      backgroundStrong: "rgba(255, 255, 255, 0.85)",
      border: "rgba(0, 0, 0, 0.08)",
      borderSubtle: "rgba(0, 0, 0, 0.04)",
    },
    dark: {
      background: "rgba(28, 28, 30, 0.72)",
      backgroundSubtle: "rgba(28, 28, 30, 0.6)",
      backgroundStrong: "rgba(28, 28, 30, 0.85)",
      border: "rgba(255, 255, 255, 0.08)",
      borderSubtle: "rgba(255, 255, 255, 0.04)",
    },
    blur: "20px",
    saturate: "180%",
  },
};

export type Tokens = typeof tokens;
