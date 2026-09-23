"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { clsx } from "clsx";
import { Sun, Moon, Bell, User, Settings, LogOut } from "lucide-react";
import { useTheme } from "@/contexts/ThemeContext";
import { usePageHeader } from "@/contexts/PageHeaderContext";
import { authClient } from "@/lib/auth-client";

export interface HeaderProps {
  title?: string;
  className?: string;
  children?: React.ReactNode;
  /** Dentro do Atrako: esconde perfil/sair (auth é do shell). */
  embedMode?: boolean;
}

export function Header({ title, className, children, embedMode = false }: HeaderProps) {
  const router = useRouter();
  const { theme, setTheme } = useTheme();
  const { summary, subtitle } = usePageHeader();
  const isDark = theme === "dark";
  const [profileOpen, setProfileOpen] = useState(false);
  const profileRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) {
        setProfileOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  async function handleSignOut() {
    setProfileOpen(false);
    await authClient.signOut();
    router.push("/auth/login");
  }

  return (
    <header
      className={clsx(
        "flex h-12 items-center justify-between px-4 shrink-0",
        "bg-white/80 dark:bg-neutral-900/80",
        "backdrop-blur-xl backdrop-saturate-150",
        "border-b border-neutral-200/60 dark:border-neutral-800/60",
        className
      )}
    >
      {/* Titulo + resumo */}
      <div className="flex items-center gap-3 min-w-0">
        {title && (
          <h1 className="text-[15px] font-semibold text-neutral-900 dark:text-neutral-100 shrink-0">
            {title}
          </h1>
        )}
        {summary && (
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 truncate">
            {summary}
          </span>
        )}
        {subtitle && !summary && (
          <span className="text-[13px] text-neutral-500 dark:text-neutral-400 truncate">
            {subtitle}
          </span>
        )}
      </div>

      {/* Acoes */}
      <div className="flex items-center gap-1.5">
        {children}

        {!embedMode && (
          <button
            type="button"
            className={clsx(
              "relative flex h-8 w-8 items-center justify-center rounded-lg",
              "text-neutral-500 dark:text-neutral-400",
              "hover:bg-neutral-100 dark:hover:bg-neutral-800",
              "transition-colors duration-fast"
            )}
            aria-label="Notificacoes"
          >
            <Bell className="h-4 w-4" strokeWidth={1.75} />
            <span className="absolute right-1.5 top-1.5 h-2 w-2 rounded-full bg-error-500" />
          </button>
        )}

        {/* Theme Toggle */}
        <button
          type="button"
          role="switch"
          aria-checked={isDark}
          onClick={() => setTheme(isDark ? "light" : "dark")}
          className={clsx(
            "flex h-8 w-8 items-center justify-center rounded-lg",
            "text-neutral-500 dark:text-neutral-400",
            "hover:bg-neutral-100 dark:hover:bg-neutral-800",
            "transition-colors duration-fast"
          )}
          aria-label="Alternar tema"
        >
          {isDark ? (
            <Moon className="h-4 w-4" strokeWidth={1.75} />
          ) : (
            <Sun className="h-4 w-4" strokeWidth={1.75} />
          )}
        </button>

        {!embedMode && (
          <>
            {/* Divider */}
            <div className="mx-1 h-5 w-px bg-neutral-200 dark:bg-neutral-700" />

            {/* Profile dropdown */}
            <div className="relative" ref={profileRef}>
              <button
                type="button"
                onClick={() => setProfileOpen(!profileOpen)}
                className={clsx(
                  "flex h-8 w-8 items-center justify-center rounded-full",
                  "bg-primary-500/10 text-primary-600",
                  "dark:bg-primary-500/20 dark:text-primary-400",
                  "hover:bg-primary-500/20 dark:hover:bg-primary-500/30",
                  "transition-colors duration-fast"
                )}
                aria-label="Perfil"
                aria-expanded={profileOpen}
              >
                <User className="h-4 w-4" strokeWidth={1.75} />
              </button>
              {profileOpen && (
                <div
                  className={clsx(
                    "absolute right-0 top-full z-50 mt-1 w-48 rounded-xl py-1",
                    "bg-white dark:bg-neutral-900",
                    "border border-neutral-200 dark:border-neutral-700",
                    "shadow-dropdown animate-scale-in"
                  )}
                >
                  <Link
                    href="/dashboard/configuracoes"
                    onClick={() => setProfileOpen(false)}
                    className="flex items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <Settings className="h-4 w-4" strokeWidth={1.75} />
                    Configurações
                  </Link>
                  <button
                    type="button"
                    onClick={handleSignOut}
                    className="flex w-full items-center gap-2 px-4 py-2.5 text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-50 dark:hover:bg-neutral-800"
                  >
                    <LogOut className="h-4 w-4" strokeWidth={1.75} />
                    Sair
                  </button>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </header>
  );
}
