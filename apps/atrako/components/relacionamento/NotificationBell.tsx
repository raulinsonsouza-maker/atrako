"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { Bell } from "lucide-react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { timeAgo } from "@/components/relacionamento/format";

export type NotificationItem = {
  id: string;
  type: string;
  title: string;
  body: string | null;
  href: string | null;
  severity: "info" | "aviso" | "urgente";
  createdAt: string;
  read: boolean;
};

export function useNotifications(workspaceId: string | null, limit = 10) {
  return useQuery({
    queryKey: ["notifications", workspaceId, limit],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/notifications?workspaceId=${workspaceId}&limit=${limit}`);
      if (!r.ok) throw new Error("fail");
      return (await r.json()) as {
        items: NotificationItem[];
        unread: number;
        prefs: { email: boolean; urgentOnly: boolean } | null;
      };
    },
    enabled: Boolean(workspaceId),
    refetchInterval: 60_000,
  });
}

export async function markNotificationsRead(workspaceId: string, body: { ids?: string[]; all?: boolean }) {
  await fetch("/api/atrako/notifications", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ workspaceId, ...body }),
  });
}

export function NotificationBell({ collapsed }: { collapsed?: boolean }) {
  const { workspaceId } = useActiveWorkspace();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const { data } = useNotifications(workspaceId, 10);
  const unread = data?.unread ?? 0;

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  if (!workspaceId) return null;

  async function openItem(n: NotificationItem) {
    if (!n.read && workspaceId) {
      await markNotificationsRead(workspaceId, { ids: [n.id] });
      void qc.invalidateQueries({ queryKey: ["notifications", workspaceId] });
    }
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="relative inline-flex h-8 w-8 items-center justify-center rounded-sm text-[var(--ink-muted-48)] hover:bg-[var(--surface-tile-2)] hover:text-[var(--on-dark)] active:scale-95"
        aria-label={unread ? `Notificações (${unread} não lidas)` : "Notificações"}
        title="Notificações"
      >
        <Bell className="h-4 w-4" strokeWidth={1.75} />
        {unread ? <span className="rel-bell-count">{unread > 99 ? "99+" : unread}</span> : null}
      </button>
      {open ? (
        <div className={`rel-bell-panel ${collapsed ? "left-10" : ""}`} role="dialog" aria-label="Notificações">
          <div className="flex items-center justify-between border-b border-[var(--divider-soft)] px-4 py-3">
            <span className="type-caption-strong">Notificações</span>
            {unread ? (
              <button
                type="button"
                className="type-fine-print text-[var(--primary)] active:scale-95"
                onClick={async () => {
                  await markNotificationsRead(workspaceId, { all: true });
                  void qc.invalidateQueries({ queryKey: ["notifications", workspaceId] });
                }}
              >
                Marcar todas como lidas
              </button>
            ) : null}
          </div>
          {data?.items.length ? (
            data.items.map((n) => (
              <Link
                key={n.id}
                href={n.href || "/notificacoes"}
                onClick={() => void openItem(n)}
                className="rel-notif"
                data-unread={!n.read}
                data-severity={n.severity}
              >
                <span className="type-caption-strong block text-[var(--ink)]">{n.title}</span>
                {n.body ? (
                  <span className="type-fine-print mt-0.5 block line-clamp-2 text-[var(--ink-muted-80)]">{n.body}</span>
                ) : null}
                <span className="type-micro-legal mt-1 block text-[var(--ink-muted-48)]">{timeAgo(n.createdAt)}</span>
              </Link>
            ))
          ) : (
            <p className="type-caption px-4 py-6 text-center text-[var(--ink-muted-48)]">Nada por aqui.</p>
          )}
          <Link
            href="/notificacoes"
            onClick={() => setOpen(false)}
            className="type-caption block px-4 py-3 text-center text-[var(--primary)]"
          >
            Ver todas
          </Link>
        </div>
      ) : null}
    </div>
  );
}
