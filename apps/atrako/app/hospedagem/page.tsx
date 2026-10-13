"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { formatBrDate } from "@/lib/stay/nights";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

type StayRow = {
  id: string;
  number: number;
  guestName: string;
  checkIn: string;
  checkOut: string;
  nights: number;
  amountCents: number;
  guests: number;
  status: string;
};

type Summary = {
  property: { name: string; slug: string };
  publicPath: string;
  nightsThisMonth: number;
  receivedCents: number;
  arrivals: StayRow[];
  pending: StayRow[];
  upcoming: StayRow[];
};

function StayList({ title, empty, rows }: { title: string; empty: string; rows: StayRow[] }) {
  return (
    <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-5">
      <h2 className="type-body-strong">{title}</h2>
      {rows.length === 0 ? <p className="type-body mt-3 text-[var(--ink-muted-80)]">{empty}</p> : null}
      <ul className="mt-3 divide-y divide-[var(--hairline)]">
        {rows.map((row) => (
          <li key={row.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
            <span className="type-body">
              {row.guestName}
              <span className="type-caption mt-1 block text-[var(--ink-muted-80)]">
                {formatBrDate(row.checkIn)} – {formatBrDate(row.checkOut)} · {row.nights} noites · {row.guests} hóspedes
              </span>
            </span>
            <strong className="type-body-strong">{brl(row.amountCents)}</strong>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default function StayHomePage() {
  const { workspaceId, isLoading: workspaceLoading, isError } = useActiveWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["stay-summary", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay/summary?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o início");
      return res.json() as Promise<{ summary: Summary | null }>;
    },
  });
  const summary = data?.summary;

  return (
    <section>
      <h1 className="type-tagline">Início</h1>
      <p className="type-body mt-2 text-[var(--ink-muted-80)]">Quem chega hoje, quem ainda não pagou e o mês da casa.</p>
      {workspaceLoading || isLoading ? <p className="type-body mt-6">Carregando…</p> : null}
      {isError ? <p className="type-body mt-6">Entre de novo para ver a casa.</p> : null}
      {summary ? (
        <>
          <div className="mt-6 grid gap-3 sm:grid-cols-2">
            <article className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-5">
              <span className="type-caption text-[var(--ink-muted-80)]">Recebido no mês</span>
              <strong className="type-tagline mt-2 block">{brl(summary.receivedCents)}</strong>
            </article>
            <article className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-5">
              <span className="type-caption text-[var(--ink-muted-80)]">Noites ocupadas no mês</span>
              <strong className="type-tagline mt-2 block">{summary.nightsThisMonth}</strong>
            </article>
          </div>
          <p className="type-body mt-4">
            <Link href={summary.publicPath} className="type-body-strong underline">
              Abrir a página pública
            </Link>
          </p>
          <div className="mt-6 grid gap-3">
            <StayList title="Chegadas de hoje" empty="Ninguém chega hoje." rows={summary.arrivals} />
            <StayList title="Aguardando pagamento" empty="Nenhuma reserva segurando datas." rows={summary.pending} />
            <StayList title="Próximas chegadas" empty="Nenhuma reserva confirmada pela frente." rows={summary.upcoming} />
          </div>
        </>
      ) : null}
    </section>
  );
}
