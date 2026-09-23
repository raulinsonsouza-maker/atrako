"use client";

import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  /** Páginas públicas / autenticação — sem sidebar do app. */
  const bare =
    pathname.startsWith("/portal") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/f/") ||
    /** Studio LP full-bleed (estilo GreatPages) */
    pathname.startsWith("/criar/oferta") ||
    pathname.startsWith("/criar/paginas");
  const moduleEmbed = pathname.startsWith("/modules/");
  /** Editor visual (Puck) precisa de altura de viewport; lista de páginas precisa de scroll. */
  const fillViewport =
    moduleEmbed ||
    pathname.startsWith("/criar/oferta") ||
    pathname.startsWith("/criar/paginas");

  if (bare) {
    return (
      <div
        className={
          fillViewport
            ? "flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--canvas-parchment)]"
            : undefined
        }
      >
        {children}
      </div>
    );
  }

  return (
    <div
      className={`flex bg-[var(--canvas-parchment)] ${fillViewport ? "h-screen overflow-hidden" : "min-h-screen"}`}
    >
      <AppSidebar />
      <div
        className={`flex min-w-0 flex-1 flex-col ${fillViewport ? "min-h-0 overflow-hidden" : ""}`}
      >
        {children}
      </div>
    </div>
  );
}
