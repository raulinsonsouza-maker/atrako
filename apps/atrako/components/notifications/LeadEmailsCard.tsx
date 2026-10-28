"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus, Trash2 } from "lucide-react";
import { Button, IconButton, TextField } from "@/components/ui";
import { api } from "@/components/relacionamento/format";

const MAX_EMAILS = 10;

type Row = { id: string; email: string };

function rowsFrom(emails: string[]): Row[] {
  return emails.map((email) => ({ id: crypto.randomUUID(), email }));
}

/** Destinatários do e-mail de lead novo (`notifyPrefs.leadEmails`). */
export function LeadEmailsCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["lead-emails", workspaceId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ leadEmails: string[] }>(`/api/atrako/notifications?workspaceId=${encodeURIComponent(workspaceId)}&leadEmails=1`),
  });
  const [rows, setRows] = useState<Row[]>([]);
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);
  const focusId = useRef<string | null>(null);

  useEffect(() => {
    if (data) setRows(rowsFrom(data.leadEmails));
  }, [data]);

  function add() {
    if (rows.length >= MAX_EMAILS) return;
    const id = crypto.randomUUID();
    focusId.current = id;
    setRows((prev) => [...prev, { id, email: "" }]);
  }

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const emails = rows.map((row) => row.email.trim()).filter(Boolean);
      const r = await api<{ leadEmails: string[] }>("/api/atrako/notifications", {
        body: { workspaceId, action: "leadEmails", emails },
      });
      setRows(rowsFrom(r.leadEmails));
      setStatus({ tone: "ok", text: r.leadEmails.length ? "Salvo." : "Aviso por e-mail desligado." });
      void qc.invalidateQueries({ queryKey: key });
    } catch (err) {
      setStatus({ tone: "bad", text: err instanceof Error ? err.message : "Não foi possível salvar" });
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rel-card space-y-3">
      <h2 className="type-body-strong text-[var(--ink)]">E-mail de lead novo</h2>
      <p className="type-caption text-[var(--ink-muted-80)]">
        Cada lead que chega gera um e-mail para a equipe. Responder fala direto com o lead.
      </p>
      <div className="space-y-2">
        <p className="type-caption-strong text-[var(--ink)]">Destinatários</p>
        {rows.map((row, index) => (
          <div key={row.id} className="flex items-end gap-2">
            <TextField
              className="min-w-0 flex-1 [&>div]:mt-0"
              label={<span className="sr-only">E-mail {index + 1}</span>}
              type="email"
              inputMode="email"
              autoComplete="off"
              placeholder="nome@email.com"
              value={row.email}
              ref={(node) => {
                if (node && focusId.current === row.id) {
                  node.focus();
                  focusId.current = null;
                }
              }}
              onChange={(e) =>
                setRows((prev) => prev.map((item) => (item.id === row.id ? { ...item, email: e.target.value } : item)))
              }
            />
            <IconButton
              size="toolbar"
              className="text-[var(--danger)]"
              aria-label={`Excluir e-mail ${index + 1}`}
              onClick={() => setRows((prev) => prev.filter((item) => item.id !== row.id))}
            >
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
          </div>
        ))}
        <p className="type-fine-print text-[var(--ink-muted-48)]">Até {MAX_EMAILS}. Sem destinatário, o aviso não sai.</p>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="button" variant="outline" size="toolbar" onClick={add} disabled={!data || rows.length >= MAX_EMAILS}>
          <Plus className="h-3.5 w-3.5" />
          Adicionar e-mail
        </Button>
        <Button type="button" onClick={() => void save()} disabled={saving || !data}>
          {saving ? "Salvando…" : "Salvar"}
        </Button>
        {status ? (
          <span className={`type-caption ${status.tone === "ok" ? "text-[var(--ink-muted-80)]" : "text-[var(--danger)]"}`}>
            {status.text}
          </span>
        ) : null}
      </div>
    </section>
  );
}
