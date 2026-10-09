"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import "@/app/food/food-shell.css";

type Role = "OWNER" | "ADMIN" | "OPERATOR";

const LINKS = [
  { href: "/food", label: "Início", manage: true },
  { href: "/food/pedidos", label: "Pedidos", manage: false },
  { href: "/food/cardapio", label: "Cardápio", manage: true },
  { href: "/food/caixa", label: "Caixa", manage: true },
  { href: "/food/clientes", label: "Clientes", manage: true },
];

export function FoodShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const { workspaceId } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["food-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/food?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar a loja");
      return res.json() as Promise<{ store: { name: string; acceptingOrders: boolean } | null; role: Role }>;
    },
  });
  const role = data?.role ?? "ADMIN";
  const manage = role !== "OPERATOR";

  useEffect(() => {
    if (!data || manage) return;
    const blocked = pathname === "/food" || LINKS.some((link) => link.manage && pathname.startsWith(link.href));
    if (blocked) router.replace("/food/pedidos");
  }, [data, manage, pathname, router]);

  const toggle = useMutation({
    mutationFn: async (acceptingOrders: boolean) => {
      const res = await fetch("/api/atrako/food", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, acceptingOrders }),
      });
      if (!res.ok) throw new Error("Não foi possível alterar a loja");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["food-store", workspaceId] }),
  });

  const links = LINKS.filter((link) => manage || !link.manage);
  const open = Boolean(data?.store?.acceptingOrders);

  return (
    <div className="food-shell">
      <nav className="food-nav">
        <div className="food-brand">{data?.store?.name || "Restaurante"}</div>
        {links.map((link) => {
          const active = link.href === "/food" ? pathname === "/food" : pathname.startsWith(link.href);
          return (
            <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
              {link.label}
            </Link>
          );
        })}
      </nav>
      <div className="food-main">
        <div className="food-banner">
          <div>
            <strong>{open ? "Loja aberta" : "Loja fechada"}</strong>
            <p>{open ? "Aceitando pedidos da loja e do WhatsApp." : "Novos pedidos ficam bloqueados até reabrir."}</p>
          </div>
          {manage ? (
            <button type="button" className="food-button" onClick={() => toggle.mutate(!open)} disabled={toggle.isPending}>
              {open ? "Fechar loja" : "Abrir loja"}
            </button>
          ) : null}
        </div>
        {children}
      </div>
    </div>
  );
}
