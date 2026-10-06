"use client";

import { useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { MobileTopBar } from "@/components/layout/MobileTopBar";

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);
  /** Páginas públicas / autenticação — sem sidebar do app. */
  const bare =
    pathname === "/" ||
    pathname.startsWith("/portal") ||
    pathname.startsWith("/sign-in") ||
    pathname.startsWith("/invite") ||
    pathname.startsWith("/change-password") ||
    pathname.startsWith("/admin") ||
    pathname.startsWith("/politica-de-privacidade") ||
    pathname.startsWith("/termos-de-uso") ||
    pathname.startsWith("/exclusao-de-dados") ||
    pathname.startsWith("/p/") ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/f/") ||
    pathname.startsWith("/u/") ||
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
      <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
      <div
        className={`flex min-w-0 flex-1 flex-col ${fillViewport ? "min-h-0 overflow-hidden" : ""}`}
      >
        <MobileTopBar onOpenMenu={() => setMobileOpen(true)} />
        {children}
      </div>
    </div>
  );
}
