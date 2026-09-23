import type { Metadata } from "next";
import { Inter, Space_Grotesk } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";
import { LayoutRouter } from "@/components/layout/LayoutRouter";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-display",
});

export const metadata: Metadata = {
  title: {
    default: "Symbius Flow | Automações Instagram",
    template: "%s | Symbius Flow",
  },
  description: "Automatize DMs e comentários no Instagram com fluxos visuais",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="pt-BR">
      <body
        className={`${inter.variable} ${spaceGrotesk.variable} font-sans min-h-screen antialiased`}
      >
        <Providers>
          <LayoutRouter>{children}</LayoutRouter>
        </Providers>
      </body>
    </html>
  );
}
