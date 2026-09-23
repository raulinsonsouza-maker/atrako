import type { Config } from "tailwindcss";

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
        background: "var(--background)",
        foreground: "var(--foreground)",
        canvas: "var(--canvas)",
        parchment: "var(--canvas-parchment)",
        ink: "var(--ink)",
        card: "var(--card)",
        "card-foreground": "var(--card-foreground)",
        primary: {
          DEFAULT: "var(--primary)",
          focus: "var(--primary-focus)",
          "on-dark": "var(--primary-on-dark)",
          foreground: "var(--primary-foreground)",
        },
        muted: {
          DEFAULT: "var(--muted)",
          foreground: "var(--muted-foreground)",
        },
        border: "var(--border)",
        hairline: "var(--hairline)",
        accent: "var(--accent)",
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
