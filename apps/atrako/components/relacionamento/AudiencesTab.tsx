"use client";

import { useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Download, Loader2, Trash2, Upload } from "lucide-react";
import { Button, OptionChip, PillSelect } from "@/components/ui";
import { api, dateBR, num } from "@/components/relacionamento/format";

type Audience = { key: string; label: string; description: string; total: number; withEmail: number; withPhone: number };
type Seasonal = { key: string; label: string; date: string; hint: string | null; enabled: boolean; leadDays: number };
type Custom = { key: string; label: string; date: string | null; recurring: boolean; enabled: boolean; leadDays: number };
type ImportStats = { total: number; imported: number; invalidEmail: number; invalidPhone: number; skipped: number; birthdays: number; consented: number };

const LEAD_OPTIONS = [15, 21, 30, 45, 60].map((n) => ({ value: String(n), label: `${n} dias antes` }));

export function AudiencesTab({ workspaceId }: { workspaceId: string }) {
  return (
    <div className="flex flex-col gap-4">
      <AdAudiences workspaceId={workspaceId} />
      <ImportContacts workspaceId={workspaceId} />
      <CalendarSettings workspaceId={workspaceId} />
    </div>
  );
}

function AdAudiences({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-audiences", workspaceId],
    queryFn: () => api<{ audiences: Audience[] }>(`/api/atrako/relacionamento/audiences?workspaceId=${workspaceId}`),
  });
  return (
    <section className="rel-card space-y-3">
      <div>
        <h2 className="type-body-strong text-[var(--ink)]">Públicos para anúncios</h2>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Exporte e suba como público personalizado no Meta Ads ou Google Ads (e-mail e telefone já vão criptografados em SHA-256). Use “Clientes” como exclusão
          nas campanhas de aquisição.
        </p>
      </div>
      {isLoading || !data ? (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      ) : (
        <table className="rel-table type-caption">
          <thead>
            <tr>
              <th>Público</th>
              <th>Contatos</th>
              <th>Com e-mail</th>
              <th>Com telefone</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {data.audiences.map((a) => (
              <tr key={a.key}>
                <td>
                  <span className="block text-[var(--ink)]">{a.label}</span>
                  <span className="type-micro-legal text-[var(--ink-muted-48)]">{a.description}</span>
                </td>
                <td className="tabular-nums">{num(a.total)}</td>
                <td className="tabular-nums">{num(a.withEmail)}</td>
                <td className="tabular-nums">{num(a.withPhone)}</td>
                <td className="text-right">
                  {a.total ? (
                    <a
                      className="inline-flex items-center gap-1 type-caption text-[var(--primary)]"
                      href={`/api/atrako/relacionamento/audiences?workspaceId=${workspaceId}&export=${a.key}`}
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </a>
                  ) : null}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}

function ImportContacts({ workspaceId }: { workspaceId: string }) {
  const [csv, setCsv] = useState<string | null>(null);
  const [fileName, setFileName] = useState("");
  const [consentConfirmed, setConsentConfirmed] = useState(false);
  const [result, setResult] = useState<{ dryRun: boolean; columns: string[]; stats: ImportStats; errors: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const run = useMutation({
    mutationFn: (dryRun: boolean) =>
      api<{ dryRun: boolean; columns: string[]; stats: ImportStats; errors: string[] }>("/api/atrako/relacionamento/import", {
        body: { workspaceId, csv, consentConfirmed, dryRun },
      }),
    onSuccess: (r) => {
      setResult(r);
      setError(null);
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="rel-card space-y-3">
      <div>
        <h2 className="type-body-strong text-[var(--ink)]">Importar contatos (CSV)</h2>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Colunas reconhecidas: nome, e-mail, telefone, aniversário (DD/MM ou DD/MM/AAAA) e consentimento (sim/não). Separador vírgula ou ponto e vírgula.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-4 py-2 type-caption text-[var(--ink)] active:scale-95">
          <Upload className="h-4 w-4" />
          {fileName || "Escolher arquivo"}
          <input
            type="file"
            accept=".csv,text/csv"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setFileName(f.name);
              setResult(null);
              setCsv(await f.text());
              e.target.value = "";
            }}
          />
        </label>
        <OptionChip className="px-3 py-1.5" selected={consentConfirmed} onClick={() => setConsentConfirmed((v) => !v)}>
          {consentConfirmed ? "✓ " : ""}Todos nesta lista aceitaram receber comunicações
        </OptionChip>
      </div>
      <p className="type-micro-legal text-[var(--ink-muted-48)]">
        LGPD: sem consentimento (coluna ou confirmação acima), o contato recebe só mensagens transacionais — nada de campanhas.
      </p>
      <div className="flex flex-wrap gap-2">
        <Button variant="outline" className="px-4 py-2" disabled={!csv || run.isPending} onClick={() => run.mutate(true)}>
          {run.isPending && run.variables === true ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Conferir
        </Button>
        <Button className="px-4 py-2" disabled={!csv || run.isPending || !result?.dryRun} onClick={() => run.mutate(false)}>
          {run.isPending && run.variables === false ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Importar
        </Button>
      </div>
      {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
      {result ? (
        <div className="space-y-1">
          <p className="type-caption text-[var(--ink)]">
            {result.dryRun ? "Prévia: " : "Importado: "}
            {num(result.stats.imported)} de {num(result.stats.total)} linhas · {num(result.stats.consented)} com consentimento · {num(result.stats.birthdays)}{" "}
            aniversários
            {result.stats.invalidEmail ? ` · ${num(result.stats.invalidEmail)} e-mails inválidos` : ""}
            {result.stats.invalidPhone ? ` · ${num(result.stats.invalidPhone)} telefones inválidos` : ""}
            {result.stats.skipped ? ` · ${num(result.stats.skipped)} ignoradas` : ""}
          </p>
          <p className="type-fine-print text-[var(--ink-muted-48)]">Colunas encontradas: {result.columns.join(", ") || "nenhuma"}</p>
          {result.errors.length ? (
            <ul className="space-y-0.5">
              {result.errors.map((e) => (
                <li key={e} className="type-fine-print text-[var(--ink-muted-80)]">
                  {e}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function CalendarSettings({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["rel-calendar", workspaceId];
  const [label, setLabel] = useState("");
  const [date, setDate] = useState("");
  const [recurring, setRecurring] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<{ seasonal: Seasonal[]; custom: Custom[] }>(`/api/atrako/relacionamento/calendar?workspaceId=${workspaceId}`),
  });
  const save = useMutation({
    mutationFn: (body: Record<string, unknown>) => api("/api/atrako/relacionamento/calendar", { body: { workspaceId, ...body } }),
    onSuccess: () => {
      setError(null);
      void qc.invalidateQueries({ queryKey: key });
      void qc.invalidateQueries({ queryKey: ["rel-campaigns", workspaceId] });
    },
    onError: (e: Error) => setError(e.message),
  });

  return (
    <section className="rel-card space-y-3">
      <div>
        <h2 className="type-body-strong text-[var(--ink)]">Datas do calendário</h2>
        <p className="type-fine-print text-[var(--ink-muted-48)]">
          Datas comerciais do varejo (as móveis são calculadas todo ano) e datas próprias da loja. Para cada data ligada, a campanha nasce com a antecedência
          escolhida e a equipe é avisada até a aprovação.
        </p>
      </div>
      {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
      {isLoading || !data ? (
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      ) : (
        <>
          <table className="rel-table type-caption">
            <thead>
              <tr>
                <th>Data</th>
                <th>Quando</th>
                <th>Criar campanha</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {data.seasonal.map((d) => (
                <tr key={d.key} style={d.enabled ? undefined : { opacity: 0.55 }}>
                  <td>
                    <span className="block text-[var(--ink)]">{d.label}</span>
                    {d.hint ? <span className="type-micro-legal text-[var(--ink-muted-48)]">{d.hint}</span> : null}
                  </td>
                  <td className="tabular-nums">{dateBR(d.date)}</td>
                  <td>
                    <PillSelect
                      value={String(d.leadDays)}
                      onChange={(v) => save.mutate({ key: d.key, leadDays: Number(v) })}
                      options={LEAD_OPTIONS}
                      aria-label="Antecedência"
                      disabled={!d.enabled}
                    />
                  </td>
                  <td className="text-right">
                    <OptionChip className="px-3 py-1.5" selected={d.enabled} onClick={() => save.mutate({ key: d.key, enabled: !d.enabled })}>
                      {d.enabled ? "Ligada" : "Desligada"}
                    </OptionChip>
                  </td>
                </tr>
              ))}
              {data.custom.map((d) => (
                <tr key={d.key} style={d.enabled ? undefined : { opacity: 0.55 }}>
                  <td>
                    <span className="block text-[var(--ink)]">{d.label}</span>
                    <span className="type-micro-legal text-[var(--ink-muted-48)]">Data da loja{d.recurring ? " · todo ano" : ""}</span>
                  </td>
                  <td className="tabular-nums">{dateBR(d.date)}</td>
                  <td>
                    <PillSelect
                      value={String(d.leadDays)}
                      onChange={(v) => save.mutate({ key: d.key, leadDays: Number(v) })}
                      options={LEAD_OPTIONS}
                      aria-label="Antecedência"
                    />
                  </td>
                  <td className="text-right">
                    <div className="inline-flex items-center gap-1">
                      <OptionChip className="px-3 py-1.5" selected={d.enabled} onClick={() => save.mutate({ key: d.key, enabled: !d.enabled })}>
                        {d.enabled ? "Ligada" : "Desligada"}
                      </OptionChip>
                      <button type="button" aria-label="Excluir" className="p-1.5 text-[var(--ink-muted-48)]" onClick={() => save.mutate({ action: "delete", key: d.key })}>
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="grid gap-2 border-t border-[var(--divider-soft)] pt-3 sm:grid-cols-[1fr_auto_auto_auto] sm:items-end">
            <label>
              <span className="rel-label type-fine-print">Nova data da loja</span>
              <input className="rel-input type-caption" placeholder="ex.: Aniversário da loja" value={label} onChange={(e) => setLabel(e.target.value)} />
            </label>
            <label>
              <span className="rel-label type-fine-print">Dia</span>
              <input className="rel-input type-caption" type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </label>
            <OptionChip className="px-3 py-1.5" selected={recurring} onClick={() => setRecurring((v) => !v)}>
              Repete todo ano
            </OptionChip>
            <Button
              className="px-4 py-2"
              disabled={save.isPending || !label.trim() || !date}
              onClick={() =>
                save.mutate(
                  { label, date, recurring },
                  {
                    onSuccess: () => {
                      setLabel("");
                      setDate("");
                    },
                  },
                )
              }
            >
              Adicionar
            </Button>
          </div>
        </>
      )}
    </section>
  );
}
