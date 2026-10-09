import type { Config } from "tailwindcss";

// Tokens são hex em CSS vars; color-mix permite modificador de opacidade (`bg-primary/10`).
// `bg-[var(--x)]/10` não gera CSS no Tailwind 3 — use a forma nomeada.
const token = (name: string) =>
  `color-mix(in srgb, var(${name}) calc(<alpha-value> * 100%), transparent)`;

const config: Config = {
  content: [
    "./pages/**/*.{js,ts,jsx,tsx,mdx}",
    "./components/**/*.{js,ts,jsx,tsx,mdx}",
    "./app/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  darkMode: "class",
  theme: {
    extend: {
      screens: {
        "phone-sm": { max: "419px" },
        phone: { max: "640px" },
        "large-phone": { max: "735px" },
        tablet: { max: "833px" },
        "desktop-sm": { max: "1068px" },
        desktop: "1069px",
        wide: "1441px",
      },
      maxWidth: {
        content: "1440px",
        prose: "980px",
      },
      colors: {
        background: token("--background"),
        foreground: token("--foreground"),
        canvas: token("--canvas"),
        parchment: token("--canvas-parchment"),
        pearl: token("--surface-pearl"),
        ink: token("--ink"),
        card: token("--card"),
        "card-foreground": token("--card-foreground"),
        primary: {
          DEFAULT: token("--primary"),
          focus: token("--primary-focus"),
          "on-dark": token("--primary-on-dark"),
          foreground: token("--primary-foreground"),
        },
        muted: {
          DEFAULT: token("--muted"),
          foreground: token("--muted-foreground"),
        },
        border: token("--border"),
        hairline: token("--hairline"),
        accent: token("--accent"),
        positive: token("--positive"),
        negative: token("--negative"),
      },
      borderRadius: {
        none: "var(--radius-none)",
        xs: "var(--radius-xs)",
        sm: "var(--radius-sm)",
        md: "var(--radius-md)",
        lg: "var(--radius-lg)",
        pill: "var(--radius-pill)",
        full: "var(--radius-full)",
      },
      boxShadow: {
        product: "var(--shadow-product)",
        none: "none",
      },
      fontFamily: {
        sans: ["var(--font-sans)"],
        display: ["var(--font-display)"],
      },
      fontWeight: {
        medium: "500",
        semibold: "500",
      },
      fontSize: {
        xs: ["12px", { lineHeight: "1.35", letterSpacing: "-0.01em" }],
        sm: ["13px", { lineHeight: "1.45", letterSpacing: "-0.011em" }],
        base: ["15px", { lineHeight: "1.5", letterSpacing: "-0.011em" }],
      },
      spacing: {
        xxs: "var(--space-xxs)",
        xs: "var(--space-xs)",
        sm: "var(--space-sm)",
        md: "var(--space-md)",
        lg: "var(--space-lg)",
        xl: "var(--space-xl)",
        xxl: "var(--space-xxl)",
        section: "var(--space-section)",
      },
    },
  },
  plugins: [],
};

export default config;
