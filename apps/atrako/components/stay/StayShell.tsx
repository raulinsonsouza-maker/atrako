"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { logoutEverywhere } from "@/lib/auth/logoutClient";
import "@/app/hospedagem/stay-shell.css";

const LINKS = [
  { href: "/hospedagem", label: "Início", exact: true },
  { href: "/hospedagem/reservas", label: "Reservas" },
  { href: "/hospedagem/calendario", label: "Calendário" },
  { href: "/hospedagem/imovel", label: "Imóvel" },
  { href: "/hospedagem/hospedes", label: "Hóspedes" },
  { href: "/hospedagem/mensagens", label: "Mensagens" },
];

export function StayShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const queryClient = useQueryClient();
  const [leaving, setLeaving] = useState(false);
  const { workspaceId } = useActiveWorkspace();
  const { data } = useQuery({
    queryKey: ["stay-property", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o imóvel");
      return res.json() as Promise<{ property: { name: string; acceptingBookings: boolean } | null }>;
    },
  });

  const toggle = useMutation({
    mutationFn: async (acceptingBookings: boolean) => {
      const res = await fetch("/api/atrako/stay", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, acceptingBookings }),
      });
      if (!res.ok) throw new Error("Não foi possível alterar o imóvel");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["stay-property", workspaceId] }),
  });

  const open = Boolean(data?.property?.acceptingBookings);

  async function leave() {
    if (leaving) return;
    setLeaving(true);
    await logoutEverywhere("/sign-in?next=/hospedagem");
  }

  return (
    <div className="stay-shell">
      <nav className="stay-nav">
        <div className="stay-brand">
          <strong>{data?.property?.name || "Imóvel"}</strong>
          <small>Anfitrião</small>
        </div>
        <div className="stay-nav__links">
          {LINKS.map((link) => {
            const active = link.exact ? pathname === link.href : pathname.startsWith(link.href);
            return (
              <Link key={link.href} href={link.href} className={active ? "is-active" : ""}>
                {link.label}
              </Link>
            );
          })}
        </div>
        <button type="button" className="stay-leave" onClick={leave} disabled={leaving}>
          {leaving ? "Saindo…" : "Sair"}
        </button>
      </nav>
      <div className="stay-main">
        {data?.property ? (
          <div className="stay-banner">
            <div>
              <strong><i className={open ? "is-open" : ""} />{open ? "Reservas abertas" : "Reservas pausadas"}</strong>
              <p>{open ? "A página pública está aceitando novas datas." : "Novas reservas ficam bloqueadas até reabrir."}</p>
            </div>
            <button type="button" className="stay-button" onClick={() => toggle.mutate(!open)} disabled={toggle.isPending}>
              {open ? "Pausar reservas" : "Abrir reservas"}
            </button>
          </div>
        ) : null}
        {children}
      </div>
    </div>
  );
}
