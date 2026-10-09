"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import "@/app/food/food-shell.css";

type Role = "OWNER" | "ADMIN" | "OPERATOR";

const LINKS = [
  { href: "/food", label: "Início", manage: true },
  { href: "/food/pedidos", label: "Pedidos", manage: false },
  { href: "/food/cardapio", label: "Cardápio", manage: true },
  { href: "/food/caixa", label: "Caixa", manage: true },
  { href: "/food/clientes", label: "Clientes", manage: true },
];

const ROLE_LABEL: Record<Role, string> = {
  OWNER: "Dono",
  ADMIN: "Administração",
  OPERATOR: "Balcão",
};

export function FoodShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
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

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await logoutEverywhere("/sign-in?next=/food");
  }

  return (
    <div className="food-shell">
      <nav className="food-nav">
        <div className="food-brand">
          <img className="food-mark" src="/food-store/assets/mascote.png" alt="" />
          <div>
            <strong>{data?.store?.name || "Restaurante"}</strong>
            <small>{ROLE_LABEL[role]}</small>
          </div>
        </div>
        <div className="food-nav__links">
          {links.map((link) => {
            const active = link.href === "/food" ? pathname === "/food" : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </div>
        <button type="button" className="food-leave" onClick={leave} disabled={leaving}>
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </nav>
      <div className="food-main">
        {data ? (
        <div className="food-banner">
          <div>
            <strong><i className={open ? "is-open" : ""} />{open ? "Loja aberta" : "Loja fechada"}</strong>
            <p>{open ? "Aceitando pedidos da loja e do WhatsApp." : "Novos pedidos ficam bloqueados até reabrir."}</p>
          </div>
          {manage ? (
            <button type="button" className="food-button" onClick={() => toggle.mutate(!open)} disabled={toggle.isPending}>
              {open ? "Fechar loja" : "Abrir loja"}
            </button>
          ) : null}
        </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
