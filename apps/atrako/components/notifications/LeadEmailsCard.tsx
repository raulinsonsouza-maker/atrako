"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui";
import { TextArea } from "@/components/ui/text-field";
import { api } from "@/components/relacionamento/format";

/** Destinatários do e-mail de lead novo (`notifyPrefs.leadEmails`). */
export function LeadEmailsCard({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["lead-emails", workspaceId];
  const { data } = useQuery({
    queryKey: key,
    queryFn: () =>
      api<{ leadEmails: string[] }>(`/api/atrako/notifications?workspaceId=${encodeURIComponent(workspaceId)}&leadEmails=1`),
  });
  const [value, setValue] = useState("");
  const [status, setStatus] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (data) setValue(data.leadEmails.join("\n"));
  }, [data]);

  async function save() {
    setSaving(true);
    setStatus(null);
    try {
      const emails = value.split(/[\s,;]+/).map((e) => e.trim()).filter(Boolean);
      const r = await api<{ leadEmails: string[] }>("/api/atrako/notifications", {
        body: { workspaceId, action: "leadEmails", emails },
      });
      setValue(r.leadEmails.join("\n"));
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
        Cada lead que chega gera um e-mail com contato, respostas da qualificação e origem. Responder o e-mail fala direto com o lead.
      </p>
      <TextArea
        label="Destinatários"
        hint="Um e-mail por linha (até 10). Deixe vazio para não enviar."
        value={value}
        onChange={setValue}
        rows={3}
      />
      <div className="flex items-center gap-3">
        <Button onClick={() => void save()} disabled={saving || !data}>
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
