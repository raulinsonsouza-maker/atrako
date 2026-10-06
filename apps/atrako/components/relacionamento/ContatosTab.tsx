"use client";

import { useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import { Download, Loader2, Upload } from "lucide-react";
import { Button, Switch } from "@/components/ui";
import { api, num, pct } from "@/components/relacionamento/format";
import { useOverview } from "@/components/relacionamento/overview";
import type { RelPeriod } from "@/components/relacionamento/period";
import { SuppressionList } from "@/components/relacionamento/DeliveriesTab";
import { RelEmpty, RelLoading, RelSection } from "@/components/relacionamento/ui";

type Audience = { key: string; label: string; description: string; total: number; withEmail: number; withPhone: number };
type ImportStats = { total: number; imported: number; invalidEmail: number; invalidPhone: number; skipped: number; birthdays: number; consented: number };

export function ContatosTab({ workspaceId, period }: { workspaceId: string; period: RelPeriod }) {
  return (
    <div className="flex flex-col gap-4">
      <Base workspaceId={workspaceId} period={period} />
      <AdAudiences workspaceId={workspaceId} />
      <ImportContacts workspaceId={workspaceId} />
      <SuppressionList workspaceId={workspaceId} />
    </div>
  );
}

function Base({ workspaceId, period }: { workspaceId: string; period: RelPeriod }) {
  const { data } = useOverview(workspaceId, period);
  if (!data) return <RelLoading compact />;
  const life = [...data.lifecycles].sort((a, b) => b.count - a.count);
  const total = life.reduce((s, l) => s + l.count, 0);
  const max = Math.max(1, ...life.map((l) => l.count));
  const b = data.birthdays;

  return (
    <div className="rel-grid-2">
      <RelSection
        title="Base por etapa"
        info="Calculado toda noite a partir dos pedidos: novos, recorrentes, em risco, inativos…"
        action={<span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{num(total)}</span>}
      >
        {life.length ? (
          <ul className="space-y-2.5">
            {life.map((l) => (
              <li key={l.lifecycle} className="space-y-1">
                <div className="flex items-baseline justify-between gap-3">
                  <span className="type-caption text-[var(--ink)]">{l.label}</span>
                  <span className="type-caption tabular-nums text-[var(--ink-muted-80)]">{num(l.count)}</span>
                </div>
                <div className="rel-meter">
                  <span style={{ width: `${(l.count / max) * 100}%` }} />
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <RelEmpty text="Os perfis aparecem depois da primeira noite com pedidos." />
        )}
      </RelSection>

      <RelSection title="Aniversários" info="Colete no formulário (campo Aniversário) ou importe uma lista abaixo. Alimenta o fluxo de aniversário.">
        <div className="space-y-3">
          <div>
            <p className="type-tagline tabular-nums text-[var(--ink)]">{pct(b.withDate, b.total)}</p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              {num(b.withDate)} de {num(b.total)} contatos com data
            </p>
          </div>
          <div className="rel-meter">
            <span style={{ width: `${b.total ? (b.withDate / b.total) * 100 : 0}%` }} />
          </div>
          <p className="type-caption text-[var(--ink)]">
            {b.thisMonth ? `${num(b.thisMonth)} fazem aniversário este mês` : "Ninguém faz aniversário este mês"}
          </p>
        </div>
      </RelSection>
    </div>
  );
}

function AdAudiences({ workspaceId }: { workspaceId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["rel-audiences", workspaceId],
    queryFn: () => api<{ audiences: Audience[] }>(`/api/atrako/relacionamento/audiences?workspaceId=${workspaceId}`),
  });
  return (
    <RelSection
      title="Públicos para anúncios"
      info="Suba o CSV como público personalizado no Meta Ads ou Google Ads — e-mail e telefone já vão criptografados (SHA-256). Use “Clientes” como exclusão nas campanhas de aquisição."
    >
      {isLoading || !data ? (
        <RelLoading compact />
      ) : (
        <div className="overflow-x-auto">
          <table className="rel-table type-caption">
            <thead>
              <tr>
                <th>Público</th>
                <th>Contatos</th>
                <th>E-mail</th>
                <th>Telefone</th>
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
                        <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                        CSV
                      </a>
                    ) : null}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </RelSection>
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
    <RelSection
      title="Importar contatos"
      info="CSV com nome, e-mail, telefone, aniversário (DD/MM ou DD/MM/AAAA) e consentimento (sim/não). Separador vírgula ou ponto e vírgula. LGPD: sem consentimento, o contato só recebe mensagens transacionais."
    >
      <div className="space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-4 py-2 type-caption text-[var(--ink)] active:scale-95">
            <Upload className="h-4 w-4" strokeWidth={1.75} />
            {fileName || "Escolher CSV"}
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
          <label className="inline-flex items-center gap-2 type-caption text-[var(--ink)]">
            <Switch checked={consentConfirmed} onChange={setConsentConfirmed} aria-label="Todos aceitaram receber" />
            Todos aceitaram receber
          </label>
          <div className="ml-auto flex gap-2">
            <Button variant="outline" className="px-4 py-2" disabled={!csv || run.isPending} onClick={() => run.mutate(true)}>
              {run.isPending && run.variables === true ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Conferir
            </Button>
            <Button className="px-4 py-2" disabled={!csv || run.isPending || !result?.dryRun} onClick={() => run.mutate(false)}>
              {run.isPending && run.variables === false ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Importar
            </Button>
          </div>
        </div>
        {error ? <p className="type-caption text-[var(--ink)]">{error}</p> : null}
        {result ? (
          <div className="rel-inset space-y-1">
            <p className="type-caption-strong text-[var(--ink)]">
              {result.dryRun ? "Prévia" : "Importado"}: {num(result.stats.imported)} de {num(result.stats.total)}
            </p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">
              {num(result.stats.consented)} com consentimento · {num(result.stats.birthdays)} aniversários
              {result.stats.invalidEmail ? ` · ${num(result.stats.invalidEmail)} e-mails inválidos` : ""}
              {result.stats.invalidPhone ? ` · ${num(result.stats.invalidPhone)} telefones inválidos` : ""}
              {result.stats.skipped ? ` · ${num(result.stats.skipped)} ignoradas` : ""}
            </p>
            <p className="type-fine-print text-[var(--ink-muted-48)]">Colunas: {result.columns.join(", ") || "nenhuma"}</p>
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
      </div>
    </RelSection>
  );
}
