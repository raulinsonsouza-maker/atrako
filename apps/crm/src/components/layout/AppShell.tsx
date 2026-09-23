"use client";

import { useState, useEffect } from "react";
import { usePathname } from "next/navigation";
import { clsx } from "clsx";
import { Moon, Sun } from "lucide-react";
import { Sidebar } from "./Sidebar";
import { Header } from "./Header";
import { EmbedTopTabs } from "./EmbedTopTabs";
import { PageHeaderProvider } from "@/contexts/PageHeaderContext";
import { useIsAtrakoEmbed } from "@/hooks/useIsAtrakoEmbed";
import { useTheme } from "@/contexts/ThemeContext";

const PATH_TITLES: Record<string, string> = {
  "/dashboard": "Visão Geral",
  "/dashboard/leads": "Pipeline",
  "/dashboard/leads/novo": "Novo Lead",
  "/dashboard/financeiro": "Financeiro",
  "/dashboard/agenda": "Agenda",
  "/dashboard/configuracoes": "Configurações",
  "/dashboard/configuracoes/sdr": "Configurações › SDR IA",
};

function titleForPath(path: string): string {
  if (PATH_TITLES[path]) return PATH_TITLES[path];
  if (/^\/dashboard\/leads\/[^/]+$/.test(path)) return "Lead";
  return "";
}

export interface AppShellProps {
  title?: string;
  children: React.ReactNode;
  headerActions?: React.ReactNode;
  tenantId?: string;
}

function EmbedThemeToggle() {
  const { theme, setTheme } = useTheme();
  const isDark = theme === "dark";
  return (
    <button
      type="button"
      role="switch"
      aria-checked={isDark}
      onClick={() => setTheme(isDark ? "light" : "dark")}
      className={clsx(
        "flex h-8 w-8 items-center justify-center rounded-lg",
        "text-neutral-500 dark:text-neutral-400",
        "hover:bg-neutral-100 dark:hover:bg-neutral-800",
        "transition-colors"
      )}
      aria-label="Alternar tema"
    >
      {isDark ? <Moon className="h-4 w-4" strokeWidth={1.75} /> : <Sun className="h-4 w-4" strokeWidth={1.75} />}
    </button>
  );
}

export function AppShell({ title, children, headerActions, tenantId }: AppShellProps) {
  const pathname = usePathname() ?? "";
  const resolvedTitle = title ?? titleForPath(pathname);
  const embedded = useIsAtrakoEmbed();
  const [branding, setBranding] = useState<{
    name: string;
    logoUrl: string | null;
    primaryColor: string | null;
  } | null>(null);

  useEffect(() => {
    if (!tenantId || embedded) return;
    import("@/server/actions/tenant")
      .then(({ getTenantBranding }) => getTenantBranding(tenantId).then(setBranding))
      .catch((err) => {
        console.error("[AppShell] Erro ao carregar branding:", err);
        setBranding({ name: "CRM", logoUrl: null, primaryColor: null });
      });
  }, [tenantId, embedded]);

  if (embedded) {
    return (
      <div className="flex h-screen flex-col overflow-hidden bg-neutral-100 dark:bg-neutral-950">
        <PageHeaderProvider>
          <EmbedTopTabs
            actions={
              <>
                {headerActions}
                <EmbedThemeToggle />
              </>
            }
          />
          <main className="min-h-0 flex-1 overflow-auto p-3 animate-fade-in lg:p-4">{children}</main>
        </PageHeaderProvider>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen bg-neutral-100 dark:bg-neutral-950">
      <Sidebar
        currentPath={pathname}
        logoUrl={branding?.logoUrl}
        primaryColor={branding?.primaryColor}
        appName={branding?.name}
      />

      <PageHeaderProvider>
        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <Header title={resolvedTitle}>{headerActions}</Header>
          <main className="min-h-0 flex-1 overflow-auto p-4 animate-fade-in lg:p-6">{children}</main>
        </div>
      </PageHeaderProvider>
    </div>
  );
}
