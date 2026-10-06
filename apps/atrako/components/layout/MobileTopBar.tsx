"use client";

import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { IconButton } from "@/components/ui";

/** Só no celular: abre a gaveta do `AppSidebar` sem cobrir o conteúdo da página. */
export function MobileTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  return (
    <div className="mobile-top-bar md:hidden">
      <IconButton size="toolbar" onClick={onOpenMenu} aria-label="Abrir menu">
        <PanelLeft className="h-4 w-4" />
      </IconButton>
      <Link href="/assistente" className="type-tagline text-[var(--ink)]">
        Atrako
      </Link>
    </div>
  );
}
