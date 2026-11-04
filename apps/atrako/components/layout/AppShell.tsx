"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { usePathname } from "next/navigation";
import { AppSidebar } from "@/components/layout/AppSidebar";
import { AppTopBar } from "@/components/layout/AppTopBar";
import { LpHostProvider, resolveLpBrand, type LpHostBrand } from "@/components/layout/LpHostContext";

const OpenAppMenuContext = createContext<() => void>(() => {});

/** Abre a gaveta do `AppSidebar` no celular — para telas com header próprio (sem `AppTopBar`). */
export function useOpenAppMenu() {
  return useContext(OpenAppMenuContext);
}

export function AppShell({ children, lpBrand = null }: { children: React.ReactNode; lpBrand?: LpHostBrand | null }) {
  const pathname = usePathname();
  const effectiveBrand = resolveLpBrand(lpBrand, pathname);
  const lpHost = effectiveBrand !== null;
  const pathArea =
    pathname === "/vilaris/crm" || pathname.startsWith("/vilaris/crm/");
  const [mobileOpen, setMobileOpen] = useState(false);
  const openMenu = useCallback(() => setMobileOpen(true), []);
  /** Páginas públicas / autenticação / área LP — sem sidebar do app. */
  const bare =
    lpHost ||
    pathArea ||
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
    pathname.startsWith("/site/") ||
    pathname.startsWith("/checkout/") ||
    pathname.startsWith("/f/") ||
    pathname === "/vilaris" ||
    pathname === "/vilaris/" ||
    pathname.startsWith("/u/") ||
    pathname.startsWith("/relatorio/") ||
    /** Studio LP full-bleed (estilo GreatPages) */
    pathname.startsWith("/criar/oferta") ||
    pathname.startsWith("/criar/paginas") ||
    pathname.startsWith("/food") ||
    pathname.startsWith("/hospedagem") ||
    pathname.startsWith("/atendimento") ||
    pathname.startsWith("/estadia") ||
    pathname.startsWith("/pagar/") ||
    pathname.startsWith("/commerce") ||
    pathname.startsWith("/loja");
  const moduleEmbed = pathname.startsWith("/modules/");
  /** O assistente tem header próprio (histórico, título, sino, nova conversa). */
  const ownHeader = pathname.startsWith("/assistente");
  /** Editor visual (Puck) e chat do assistente precisam de altura de viewport; lista de páginas precisa de scroll. */
  const fillViewport =
    moduleEmbed ||
    pathname.startsWith("/assistente") ||
    pathname.startsWith("/criar/oferta") ||
    pathname.startsWith("/criar/paginas");

  if (bare) {
    return (
      <LpHostProvider value={effectiveBrand}>
        <div
          className={
            fillViewport
              ? "flex h-dvh min-h-0 flex-col overflow-hidden bg-[var(--canvas-parchment)]"
              : undefined
          }
        >
          {children}
        </div>
      </LpHostProvider>
    );
  }

  return (
    <OpenAppMenuContext.Provider value={openMenu}>
      <LpHostProvider value={effectiveBrand}>
        <div
          className={`flex bg-[var(--canvas-parchment)] ${fillViewport ? "h-screen overflow-hidden" : "min-h-screen"}`}
        >
          <AppSidebar mobileOpen={mobileOpen} onMobileOpenChange={setMobileOpen} />
          <div
            className={`flex min-w-0 flex-1 flex-col ${fillViewport ? "min-h-0 overflow-hidden" : ""}`}
          >
            {ownHeader ? null : <AppTopBar onOpenMenu={openMenu} />}
            {children}
          </div>
        </div>
      </LpHostProvider>
    </OpenAppMenuContext.Provider>
  );
}
