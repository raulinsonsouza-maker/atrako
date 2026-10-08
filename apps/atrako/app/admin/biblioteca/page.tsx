"use client";

import { useMemo, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { AppPage } from "@/components/layout/AppPage";
import { Button, PillSelect } from "@/components/ui";
import { LP_SECTION_KINDS } from "@/lib/criar/lp-library/kinds";

type Row = {
  id: string;
  kind: string;
  goal: string | null;
  html: string;
  css: string;
  fx: string[];
  tags: string[];
  status: string;
  score: number;
  uses: number;
  origem: string;
};

const STATUS_OPTIONS = [
  { value: "", label: "Todos os status" },
  { value: "candidate", label: "Candidatas" },
  { value: "approved", label: "Aprovadas" },
  { value: "rejected", label: "Recusadas" },
];

function sample(html: string) {
  return html
    .replaceAll("{{headline}}", "Promessa principal do negócio")
    .replaceAll("{{cta}}", "Quero começar")
    .replaceAll("{{img:secao}}", "")
    .replace(/\{\{[^}]+\}\}/g, "Texto de exemplo");
}

function previewDoc(row: Row) {
  const css = `.atrako-lp-v3{font-family:Inter,sans-serif;color:#1d1d1f;background:#fff}${row.css}`;
  return `<!doctype html><html><head><meta charset="utf-8"><style>${css}</style></head><body><div class="atrako-lp-v3">${sample(row.html)}</div></body></html>`;
}

export default function BibliotecaPage() {
  const [status, setStatus] = useState("candidate");
  const [kind, setKind] = useState("");
  const [open, setOpen] = useState<string | null>(null);
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["lp-library", status, kind],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (status) params.set("status", status);
      if (kind) params.set("kind", kind);
      const res = await fetch(`/api/admin/biblioteca?${params}`);
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível carregar a biblioteca.");
      return (data.rows ?? []) as Row[];
    },
  });

  const save = useMutation({
    mutationFn: async (body: { id: string; status?: string; tags?: string[] }) => {
      const res = await fetch("/api/admin/biblioteca", {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error || "Não foi possível atualizar.");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["lp-library"] }),
  });

  const kindOptions = useMemo(
    () => [{ value: "", label: "Todos os tipos" }, ...LP_SECTION_KINDS.map((value) => ({ value, label: value }))],
    [],
  );
  const current = query.data?.find((row) => row.id === open) ?? null;

  return (
    <AppPage
      title="Biblioteca de seções"
      actions={
        <div className="flex flex-wrap gap-2">
          <PillSelect value={status} onChange={setStatus} options={STATUS_OPTIONS} aria-label="Status" />
          <PillSelect value={kind} onChange={setKind} options={kindOptions} aria-label="Tipo" />
        </div>
      }
    >
      {query.isLoading ? <p className="type-body text-[var(--ink-muted-80)]">Carregando…</p> : null}
      {query.error ? <p className="type-body text-[var(--ink)]">{query.error instanceof Error ? query.error.message : "Erro"}</p> : null}
      <ul className="flex flex-col gap-3">
        {(query.data ?? []).map((row) => (
          <li key={row.id} className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="type-body text-[var(--ink)]">{row.kind}</p>
                <p className="type-fine-print text-[var(--ink-muted-80)]">
                  {row.origem} · nota {row.score} · {row.uses} usos · {row.goal ?? "—"}
                  {row.tags.length ? ` · ${row.tags.join(", ")}` : ""}
                  {row.fx.length ? ` · ${row.fx.join(", ")}` : ""}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" variant="ghost" size="toolbar" onClick={() => setOpen(open === row.id ? null : row.id)}>
                  {open === row.id ? "Fechar" : "Prévia"}
                </Button>
                <Button type="button" variant="primary" size="toolbar" disabled={save.isPending} onClick={() => save.mutate({ id: row.id, status: "approved" })}>
                  Aprovar
                </Button>
                <Button type="button" variant="outline" size="toolbar" disabled={save.isPending} onClick={() => save.mutate({ id: row.id, status: "rejected" })}>
                  Recusar
                </Button>
              </div>
            </div>
            {current?.id === row.id ? (
              <iframe title={`Prévia ${row.kind}`} className="mt-4 h-80 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)]" sandbox="" srcDoc={previewDoc(row)} />
            ) : null}
          </li>
        ))}
      </ul>
      {query.data && query.data.length === 0 ? <p className="type-body text-[var(--ink-muted-80)]">Nenhuma seção neste filtro.</p> : null}
    </AppPage>
  );
}
