"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  ExternalLink,
  FileText,
  Image as ImageIcon,
  LayoutDashboard,
  Palette,
  LogOut,
  Package,
  PanelLeft,
  ShoppingBag,
  Tag,
  Ticket,
  Truck,
} from "lucide-react";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import "@/app/commerce/commerce-shell.css";

const COLLAPSED_KEY = "atrako-commerce-nav-collapsed";

const LINKS = [
  { href: "/commerce", label: "Início", exact: true, icon: LayoutDashboard },
  { href: "/commerce/produtos", label: "Produtos", icon: Package },
  { href: "/commerce/categorias", label: "Categorias", icon: Tag },
  { href: "/commerce/banners", label: "Banners", icon: ImageIcon },
  { href: "/commerce/aparencia", label: "Aparência", icon: Palette },
  { href: "/commerce/pedidos", label: "Pedidos", icon: ShoppingBag },
  { href: "/commerce/frete", label: "Frete", icon: Truck },
  { href: "/commerce/cupons", label: "Cupons", icon: Ticket },
  { href: "/commerce/paginas", label: "Páginas", icon: FileText },
];

export function CommerceShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [drawer, setDrawer] = useState(false);
  const { workspaceId, isReady, isError } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar a loja");
      return res.json() as Promise<{
        store: {
          name: string;
          acceptingOrders: boolean;
          publicUrl: string;
          slug: string;
        } | null;
        mpConnected?: boolean;
      }>;
    },
  });

  useEffect(() => {
    setCollapsed(localStorage.getItem(COLLAPSED_KEY) === "1");
  }, []);

  useEffect(() => {
    setDrawer(false);
  }, [pathname]);

  const toggle = useMutation({
    mutationFn: async (acceptingOrders: boolean) => {
      const res = await fetch("/api/atrako/commerce/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, acceptingOrders }),
      });
      if (!res.ok) throw new Error("Não foi possível alterar a loja");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-store", workspaceId] }),
  });

  const open = Boolean(data?.store?.acceptingOrders);
  const panelHref = workspaceId ? `/clientes/${workspaceId}` : "/clientes";

  function toggleNav() {
    if (window.matchMedia("(max-width: 833px)").matches) {
      setDrawer((value) => !value);
      return;
    }
    setCollapsed((value) => {
      localStorage.setItem(COLLAPSED_KEY, value ? "0" : "1");
      return !value;
    });
  }

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await logoutEverywhere("/sign-in?next=/commerce");
  }

  return (
    <div className={`commerce-shell${collapsed ? " is-collapsed" : ""}${drawer ? " is-drawer" : ""}`}>
      <header className="commerce-top">
        <button
          type="button"
          className="commerce-icon-btn"
          onClick={toggleNav}
          aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
        >
          <PanelLeft className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <div className="commerce-top__brand">
          <strong>{data?.store?.name || "Loja"}</strong>
          <small>Gerenciamento</small>
        </div>
        <div className="commerce-top__actions">
          {data?.store ? (
            <button
              type="button"
              className="commerce-status"
              onClick={() => toggle.mutate(!open)}
              disabled={toggle.isPending}
            >
              <i className={open ? "is-open" : ""} />
              {open ? "Loja aberta" : "Loja pausada"}
            </button>
          ) : null}
          {data?.store?.publicUrl ? (
            <Link href={data.store.publicUrl} target="_blank" className="commerce-top__link">
              <ExternalLink className="h-3.5 w-3.5" strokeWidth={1.75} />
              <span>Ver loja</span>
            </Link>
          ) : null}
          <Link href={panelHref} className="commerce-top__link">
            <span>Painel</span>
          </Link>
          <button type="button" className="commerce-icon-btn" onClick={leave} disabled={leaving} aria-label="Sair">
            <LogOut className="h-4 w-4" strokeWidth={1.75} />
          </button>
        </div>
      </header>

      <div className="commerce-body">
        {drawer ? (
          <button type="button" className="commerce-backdrop" aria-label="Fechar menu" onClick={() => setDrawer(false)} />
        ) : null}
        <aside className="commerce-side">
          <nav>
            {LINKS.map((link) => {
              const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
              const Icon = link.icon;
              return (
                <Link key={link.href} href={link.href} className={active ? "is-active" : ""} title={link.label}>
                  <Icon className="h-4 w-4 shrink-0" strokeWidth={1.75} />
                  <span>{link.label}</span>
                </Link>
              );
            })}
          </nav>
        </aside>
        <main className="commerce-main">
          {isReady && (isError || !workspaceId) ? (
            <p className="type-body">
              Sessão expirada.{" "}
              <Link href="/sign-in?next=/commerce" className="text-[var(--primary)]">
                Entrar de novo
              </Link>{" "}
              para gerenciar a loja.
            </p>
          ) : (
            children
          )}
        </main>
      </div>
    </div>
  );
}
