"use client";

import { Logo } from "@/components/brand/Logo";
import { DarkGradientBg } from "@/components/ui/elegant-dark-pattern";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ReactNode } from "react";
import { cn } from "@/lib/utils";

const links = [
  { href: "/membros", label: "Meus produtos" },
  { href: "/membros/conta", label: "Conta" },
];

export function MembersShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  return (
    <DarkGradientBg showLights={false}>
      <div data-theme="members" className="min-h-screen text-[var(--ink)]">
        <header className="border-b border-[var(--border)] bg-black/50 backdrop-blur-md">
          <div className="container flex h-14 items-center justify-between">
            <Logo href="/membros" />
            <nav className="cluster">
              {links.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className={cn(
                    "no-underline text-[var(--text-sm)] font-medium",
                    pathname === link.href
                      ? "text-[var(--accent)]"
                      : "text-[var(--muted)] hover:text-[var(--ink)]",
                  )}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </header>
        <main className="container py-8 animate-enter">{children}</main>
      </div>
    </DarkGradientBg>
  );
}
