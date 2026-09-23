"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { cn } from "@/lib/utils";

const ADMIN_NAV = [
  { href: "/admin/clientes", label: "Workspaces" },
  { href: "/admin/apps", label: "Apps" },
  { href: "/admin/usuarios", label: "Usuários" },
  { href: "/admin/configuracoes", label: "Ops / alertas" },
] as const;

type MeResponse = {
  role: string | null;
  username?: string | null;
  openAccess?: boolean;
  mustChangePassword?: boolean;
};

/**
 * Shell exclusivo do painel staff — sem AppSidebar do dealer.
 */
export function AdminShell({
  children,
  identity,
}: {
  children: React.ReactNode;
  /** Server-passed identity (preferred); client fetch as fallback. */
  identity?: { username: string; role: string; openAccess: boolean };
}) {
  const pathname = usePathname();
  const { data: me } = useQuery({
    queryKey: ["internal-me"],
    queryFn: async () => {
      const r = await fetch("/api/internal/me");
      if (!r.ok) return { role: null } as MeResponse;
      return r.json() as Promise<MeResponse>;
    },
    enabled: !identity,
  });

  const username = identity?.username ?? me?.username ?? "staff";
  const role = identity?.role ?? me?.role ?? "ADMIN";
  const openAccess = identity?.openAccess ?? me?.openAccess ?? false;

  return (
    <div className="flex min-h-screen bg-[var(--canvas-parchment)]">
      <aside className="sticky top-0 flex h-screen w-[240px] shrink-0 flex-col border-r border-[var(--hairline)] bg-[var(--surface-black)]">
        <div className="border-b border-[var(--surface-tile-2)] px-5 py-5">
          <p className="type-nav-link text-[var(--on-dark)]">Atrako Admin</p>
          <p className="type-fine-print mt-1 text-[var(--body-muted)]">Plataforma</p>
        </div>

        <nav className="flex flex-1 flex-col gap-0.5 px-3 py-4">
          {ADMIN_NAV.map((item) => {
            const active =
              pathname === item.href ||
              (item.href !== "/admin/clientes" && pathname.startsWith(item.href)) ||
              (item.href === "/admin/clientes" &&
                (pathname === "/admin" || pathname.startsWith("/admin/clientes")));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "rounded-[var(--radius-xs)] px-3 py-2.5 type-nav-link transition",
                  active
                    ? "bg-[var(--primary)] text-[var(--on-primary)]"
                    : "text-[var(--body-muted)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)]",
                )}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-[var(--surface-tile-2)] px-5 py-4">
          <p className="type-fine-print text-[var(--on-dark)]">{username}</p>
          <p className="type-fine-print mt-0.5 text-[var(--body-muted)]">
            {openAccess ? "Modo aberto (dev)" : `Staff ${role}`}
          </p>
          <Link
            href="/admin/conexoes"
            className="type-fine-print mt-3 inline-block text-[var(--body-muted)] underline-offset-2 hover:text-[var(--on-dark)] hover:underline"
          >
            Legado ads
          </Link>
        </div>
      </aside>

      <div className="flex min-h-0 min-w-0 flex-1 flex-col">{children}</div>
    </div>
  );
}
