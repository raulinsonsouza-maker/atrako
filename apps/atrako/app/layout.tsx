import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import { Inter } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Atrako",
  description: "Inteligência comercial para vender mais",
};

/** App inteiro depende de DB/auth — sem static prerender no `next build`. */
export const dynamic = "force-dynamic";

const fontVars = {
  "--font-sans":
    "var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "--font-display":
    "var(--font-inter), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} font-sans min-h-screen bg-[var(--canvas-parchment)] text-[var(--ink)]`}
        style={fontVars}
      >
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
