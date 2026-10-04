"use client";

import Link from "next/link";
import { useState } from "react";
import { Loader2 } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AppPage } from "@/components/layout/AppPage";
import { Button, OptionChip } from "@/components/ui";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { markNotificationsRead, useNotifications } from "@/components/relacionamento/NotificationBell";
import { api, timeAgo } from "@/components/relacionamento/format";

const SEVERITY_LABEL = { info: "Info", aviso: "Aviso", urgente: "Urgente" } as const;

export default function NotificacoesPage() {
  const { workspaceId, isLoading } = useActiveWorkspace();
  const qc = useQueryClient();
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const { data, isLoading: loading } = useNotifications(workspaceId, 100);
  const items = (data?.items ?? []).filter((n) => filter === "all" || !n.read);
  const refresh = () => qc.invalidateQueries({ queryKey: ["notifications", workspaceId] });

  async function savePrefs(next: { email: boolean; urgentOnly: boolean }) {
    if (!workspaceId) return;
    await api("/api/atrako/notifications", { body: { workspaceId, action: "prefs", ...next } });
    void refresh();
  }

  return (
    <AppPage
      title="Notificações"
      narrow
      actions={
        data?.unread ? (
          <Button
            variant="outline"
            onClick={async () => {
              if (!workspaceId) return;
              await markNotificationsRead(workspaceId, { all: true });
              void refresh();
            }}
          >
            Marcar todas como lidas
          </Button>
        ) : null
      }
    >
      {isLoading || loading ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : (
        <>
          <div className="flex flex-wrap gap-2">
            <OptionChip selected={filter === "all"} onClick={() => setFilter("all")}>
              Todas
            </OptionChip>
            <OptionChip selected={filter === "unread"} onClick={() => setFilter("unread")}>
              Não lidas {data?.unread ? `(${data.unread})` : ""}
            </OptionChip>
          </div>

          <div className="rel-card p-0">
            {items.length ? (
              items.map((n) => (
                <Link
                  key={n.id}
                  href={n.href || "#"}
                  className="rel-notif"
                  data-unread={!n.read}
                  data-severity={n.severity}
                  onClick={async () => {
                    if (!n.read && workspaceId) {
                      await markNotificationsRead(workspaceId, { ids: [n.id] });
                      void refresh();
                    }
                  }}
                >
                  <span className="flex items-center gap-2">
                    <span className="type-caption-strong text-[var(--ink)]">{n.title}</span>
                    {n.severity !== "info" ? (
                      <span className="rel-badge type-micro-legal" data-tone={n.severity === "urgente" ? "bad" : "warn"}>
                        {SEVERITY_LABEL[n.severity]}
                      </span>
                    ) : null}
                  </span>
                  {n.body ? <span className="type-caption mt-1 block text-[var(--ink-muted-80)]">{n.body}</span> : null}
                  <span className="type-micro-legal mt-1 block text-[var(--ink-muted-48)]">{timeAgo(n.createdAt)}</span>
                </Link>
              ))
            ) : (
              <p className="type-caption px-4 py-10 text-center text-[var(--ink-muted-48)]">
                {filter === "unread" ? "Tudo lido." : "Nenhuma notificação ainda."}
              </p>
            )}
          </div>

          {data?.prefs ? (
            <section className="rel-card space-y-3">
              <h2 className="type-body-strong text-[var(--ink)]">Receber por e-mail</h2>
              <p className="type-caption text-[var(--ink-muted-80)]">
                Avisos e urgências (campanhas a aprovar, domínio com problema, conta do WhatsApp) também chegam no seu e-mail.
              </p>
              <div className="flex flex-wrap gap-2">
                <OptionChip
                  selected={data.prefs.email && !data.prefs.urgentOnly}
                  onClick={() => void savePrefs({ email: true, urgentOnly: false })}
                >
                  Avisos e urgências
                </OptionChip>
                <OptionChip
                  selected={data.prefs.email && data.prefs.urgentOnly}
                  onClick={() => void savePrefs({ email: true, urgentOnly: true })}
                >
                  Só urgências
                </OptionChip>
                <OptionChip selected={!data.prefs.email} onClick={() => void savePrefs({ email: false, urgentOnly: false })}>
                  Não receber
                </OptionChip>
              </div>
            </section>
          ) : null}
        </>
      )}
    </AppPage>
  );
}
