import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import localFont from "next/font/local";
import Script from "next/script";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";

const geist = localFont({
  src: "../public/fonts/geist-latin.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Atrako",
  description: "Inteligência comercial para vender mais",
};

/** App inteiro depende de DB/auth — sem static prerender no `next build`. */
export const dynamic = "force-dynamic";

const themeBoot = `(function(){try{if(localStorage.getItem("atrako-theme")==="dark"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark");}}catch(e){}})();`;

const fontVars = {
  "--font-sans":
    "var(--font-geist), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "--font-display":
    "var(--font-geist), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as CSSProperties;

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR" suppressHydrationWarning>
      <body
        className={`${geist.variable} font-sans min-h-screen bg-[var(--canvas-parchment)] text-[var(--ink)]`}
        style={fontVars}
      >
        <Script id="atrako-theme" strategy="beforeInteractive">
          {themeBoot}
        </Script>
        <Providers>
          <AppShell>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
