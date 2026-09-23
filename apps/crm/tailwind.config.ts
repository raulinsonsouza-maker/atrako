import type { Config } from "tailwindcss";
import { tokens } from "./src/design/tokens";

const config: Config = {
  darkMode: "class",
  content: [
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/design/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        border: "var(--color-border)",
        primary: tokens.colors.primary,
        accent: tokens.colors.accent,
        neutral: tokens.colors.neutral,
        success: tokens.colors.success,
        warning: tokens.colors.warning,
        error: tokens.colors.error,
        tint: tokens.colors.tint,
      },
      spacing: tokens.spacing,
      borderRadius: tokens.radius,
      boxShadow: tokens.shadows,
      transitionDuration: tokens.motion.duration,
      transitionTimingFunction: {
        DEFAULT: tokens.motion.ease.default,
        apple: tokens.motion.ease.default,
        "apple-in": tokens.motion.ease.in,
        "apple-out": tokens.motion.ease.out,
        "apple-inout": tokens.motion.ease.inOut,
        spring: tokens.motion.ease.spring,
      },
      fontFamily: {
        sans: tokens.typography.fontFamily.sans,
        mono: tokens.typography.fontFamily.mono,
      },
      fontSize: {
        "caption-2": tokens.typography.fontSize["caption-2"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        "caption-1": tokens.typography.fontSize["caption-1"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        footnote: tokens.typography.fontSize.footnote as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        subhead: tokens.typography.fontSize.subhead as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        callout: tokens.typography.fontSize.callout as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        body: tokens.typography.fontSize.body as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        headline: tokens.typography.fontSize.headline as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        "title-3": tokens.typography.fontSize["title-3"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        "title-2": tokens.typography.fontSize["title-2"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        "title-1": tokens.typography.fontSize["title-1"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        "large-title": tokens.typography.fontSize["large-title"] as [string, { lineHeight: string; letterSpacing?: string; fontWeight?: string }],
        // Fallback sizes
        xs: ["12px", { lineHeight: "16px" }],
        sm: ["13px", { lineHeight: "18px" }],
        base: ["15px", { lineHeight: "20px" }],
        lg: ["17px", { lineHeight: "22px" }],
        xl: ["20px", { lineHeight: "25px" }],
        "2xl": ["22px", { lineHeight: "28px" }],
        "3xl": ["28px", { lineHeight: "34px" }],
        "4xl": ["34px", { lineHeight: "41px" }],
      },
      fontWeight: tokens.typography.fontWeight,
      backdropBlur: {
        xs: "4px",
        sm: "8px",
        DEFAULT: "12px",
        md: "16px",
        lg: "20px",
        xl: "24px",
        "2xl": "40px",
      },
      backdropSaturate: {
        DEFAULT: "180%",
        150: "150%",
        180: "180%",
        200: "200%",
      },
      animation: {
        "fade-in": "fadeIn 200ms ease-out",
        "fade-out": "fadeOut 200ms ease-in",
        "slide-up": "slideUp 200ms ease-out",
        "slide-down": "slideDown 200ms ease-out",
        "scale-in": "scaleIn 200ms ease-out",
        "scale-out": "scaleOut 150ms ease-in",
        "modal-in": "modalIn 250ms cubic-bezier(0.175, 0.885, 0.32, 1.275)",
        "modal-out": "modalOut 200ms ease-in",
      },
      keyframes: {
        fadeIn: {
          "0%": { opacity: "0" },
          "100%": { opacity: "1" },
        },
        fadeOut: {
          "0%": { opacity: "1" },
          "100%": { opacity: "0" },
        },
        slideUp: {
          "0%": { transform: "translateY(8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        slideDown: {
          "0%": { transform: "translateY(-8px)", opacity: "0" },
          "100%": { transform: "translateY(0)", opacity: "1" },
        },
        scaleIn: {
          "0%": { transform: "scale(0.95)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        scaleOut: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.95)", opacity: "0" },
        },
        modalIn: {
          "0%": { transform: "scale(0.96)", opacity: "0" },
          "100%": { transform: "scale(1)", opacity: "1" },
        },
        modalOut: {
          "0%": { transform: "scale(1)", opacity: "1" },
          "100%": { transform: "scale(0.96)", opacity: "0" },
        },
      },
    },
  },
  plugins: [],
};

export default config;
