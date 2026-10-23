import type { Metadata } from "next";
import type { CSSProperties, ReactNode } from "react";
import localFont from "next/font/local";
import Script from "next/script";
import { headers } from "next/headers";
import "./globals.css";
import { Providers } from "./providers";
import { AppShell } from "@/components/layout/AppShell";
import { LP_DOMAINS } from "@/lib/lp-domains";
import { lpHostBrand } from "@/lib/brand/lp-host-brand";

const geist = localFont({
  src: "../public/fonts/geist-latin.woff2",
  variable: "--font-geist",
  display: "swap",
  weight: "100 900",
});

async function requestHost() {
  return ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
}

export async function generateMetadata(): Promise<Metadata> {
  const lp = LP_DOMAINS[await requestHost()];
  if (lp) {
    return { title: lp.name, icons: { icon: lp.icon, apple: lp.appleIcon } };
  }
  return {
    title: "Atrako",
    description: "Inteligência comercial para vender mais",
    icons: { icon: "/icon.svg" },
  };
}

/** App inteiro depende de DB/auth — sem static prerender no `next build`. */
export const dynamic = "force-dynamic";

const themeBoot = `(function(){try{if(localStorage.getItem("atrako-theme")==="dark"){document.documentElement.setAttribute("data-theme","dark");document.documentElement.classList.add("dark");}}catch(e){}})();`;

const fontVars = {
  "--font-sans":
    "var(--font-geist), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
  "--font-display":
    "var(--font-geist), system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
} as CSSProperties;

export default async function RootLayout({ children }: { children: ReactNode }) {
  const lpBrand = await lpHostBrand(await requestHost());
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
          <AppShell lpBrand={lpBrand}>{children}</AppShell>
        </Providers>
      </body>
    </html>
  );
}
