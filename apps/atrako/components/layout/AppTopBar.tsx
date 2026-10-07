"use client";

import Link from "next/link";
import { PanelLeft } from "lucide-react";
import { IconButton } from "@/components/ui";
import { useModules } from "@/hooks/useModules";
import { NotificationBell } from "@/components/relacionamento/NotificationBell";

/** Topo da área de conteúdo: notificações à direita; no celular também abre a gaveta do `AppSidebar`. */
export function AppTopBar({ onOpenMenu }: { onOpenMenu: () => void }) {
  const { homeHref } = useModules();
  return (
    <div className="app-top-bar">
      <IconButton size="toolbar" className="md:hidden" onClick={onOpenMenu} aria-label="Abrir menu">
        <PanelLeft className="h-4 w-4" />
      </IconButton>
      <Link href={homeHref} className="type-tagline text-[var(--ink)] md:hidden">
        Atrako
      </Link>
      <div className="ml-auto">
        <NotificationBell />
      </div>
    </div>
  );
}
