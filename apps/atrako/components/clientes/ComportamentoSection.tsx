"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { Loader2, ShoppingBag } from "lucide-react";
import { Bar, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { useIsMobile } from "@/hooks/useIsMobile";
import { mobileTickInterval } from "@/lib/chart-mobile";

type Money = { pedidos: number; receitaCents: number };
type Ticket = {
  pedidoCents: number | null;
  porClienteCents: number | null;
  primeiraCents: number | null;
  recompraCents: number | null;
  pedidos: number;
  compradores: number;
  receitaCents: number;
};
type Comportamento = {
  tickets: Ticket;
  ticketsAnterior: Ticket;
  leitura: string;
  recompra: {
    receitaPrimeiraCents: number;
    receitaRecompraCents: number;
    pedidosPrimeira: number;
    pedidosRecompra: number;
    participacaoRecorrentesPct: number | null;
    pedidosSemContato: number;
    receitaSemContatoCents: number;
  };
  ltv: { medioCents: number | null; compradores: number; receitaCents: number };
  origens: Array<{ id: string; label: string; clientes: number; receitaCents: number; ticketCents: number | null; recompraPct: number | null }>;
  topCompradores: Array<{ nome: string; pedidos: number; receitaCents: number }>;
  produtos: Array<{ nome: string; quantidade: number; receitaCents: number; compradores: number; ticketCents: number | null; recompras: number; imageUrl: string | null; productUrl: string | null }>;
  pares: Array<{ de: string; para: string; compradores: number }>;
  serie: Array<{ data: string; totalCents: number; primeiraCents: number; recompraCents: number }>;
  serieAgrupamento: "dia" | "semana";
  heatmap: number[][];
  genero: { f: Money; m: Money; u: Money };
  estados: Array<{ uf: string; nome: string; pedidos: number; receitaCents: number; cidades: Array<{ nome: string; pedidos: number; receitaCents: number }> }>;
};

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("pt-BR")}%`);

function ProductPhoto({ src }: { src: string | null }) {
  const [failed, setFailed] = useState(false);
  if (!src || failed) {
    return (
      <span className="flex h-20 w-20 shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] text-[var(--muted-foreground)]">
        <ShoppingBag className="h-5 w-5" strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] shadow-product">
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
    </span>
  );
}

function Produtos({ produtos }: { produtos: Comportamento["produtos"] }) {
  const max = Math.max(1, ...produtos.map((p) => p.receitaCents));
  return (
    <ul className="space-y-4">
      {produtos.map((row, index) => {
        const share = Math.max(2, Math.round((row.receitaCents / max) * 100));
        const nome = row.productUrl ? (
          <a
            href={row.productUrl}
            target="_blank"
            rel="noreferrer"
            className="line-clamp-2 type-caption text-[var(--foreground)] underline-offset-2 hover:underline"
          >
            {row.nome}
          </a>
        ) : (
          <span className="line-clamp-2 type-caption text-[var(--foreground)]">{row.nome}</span>
        );
        return (
          <li key={`${row.nome}-${index}`} className="flex items-center gap-3">
            <ProductPhoto src={row.imageUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                {nome}
                <span className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">{money(row.receitaCents)}</span>
              </div>
              <p className="mt-0.5 type-fine-print text-[var(--muted-foreground)]">
                {num(row.quantidade)} un. · {num(row.compradores)} {row.compradores === 1 ? "comprador" : "compradores"} · ticket {money(row.ticketCents)}
                {row.recompras > 0 ? ` · ${num(row.recompras)} ${row.recompras === 1 ? "voltou" : "voltaram"}` : ""}
              </p>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--divider-soft)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${share}%` }} />
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

function Card({ title, hint, children, fill = false }: { title: string; hint?: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 ${fill ? "flex min-h-0 flex-col" : ""}`}>
      <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</p>
      {hint ? <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p> : null}
      <div className={fill ? "mt-3 flex min-h-0 flex-1 flex-col" : "mt-3"}>{children}</div>
    </div>
  );
}

type Estado = Comportamento["estados"][number];

function shareOf(part: number, total: number): number | null {
  if (total <= 0) return null;
  return Math.round((part / total) * 1000) / 10;
}

function ShareRow({
  label,
  cents,
  pedidos,
  total,
  pressed,
  onClick,
}: {
  label: string;
  cents: number;
  pedidos: number;
  total: number;
  pressed?: boolean;
  onClick?: () => void;
}) {
  const share = shareOf(cents, total) ?? 0;
  const body = (
    <>
      <span className="flex items-baseline justify-between gap-3">
        <span className="type-caption text-[var(--foreground)]">{label}</span>
        <span className="type-caption tabular-nums text-[var(--foreground)]">
          {money(cents)}
          <span className="ml-2 text-[var(--muted-foreground)]">{pct(shareOf(cents, total))}</span>
        </span>
      </span>
      <span className="mt-1.5 flex h-1.5 overflow-hidden rounded-full bg-[var(--divider-soft)]">
        <span
          className="h-full rounded-full bg-[var(--primary)]"
          style={{ width: `${Math.max(share > 0 ? 2 : 0, Math.min(100, share))}%`, opacity: pressed === false ? 0.45 : 1 }}
        />
      </span>
      <span className="mt-1 block type-fine-print text-[var(--muted-foreground)]">
        {num(pedidos)} {pedidos === 1 ? "pedido" : "pedidos"}
      </span>
    </>
  );
  if (!onClick) return <div className="px-2 py-2">{body}</div>;
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={pressed}
      className={`w-full rounded-[var(--radius-xs)] px-2 py-2 text-left active:scale-[0.99] ${
        pressed ? "bg-[var(--divider-soft)]" : ""
      }`}
    >
      {body}
    </button>
  );
}

function Lugares({ estados }: { estados: Estado[] }) {
  const [uf, setUf] = useState<string | null>(null);
  const totalCents = estados.reduce((s, e) => s + e.receitaCents, 0);
  const active = estados.find((e) => e.uf === uf) ?? estados[0];
  if (!active) return null;

  return (
    <div>
      <div className="grid gap-4 lg:grid-cols-2">
        <div>
          <p className="px-2 type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">Estados</p>
          <ul className="mt-1 max-h-80 space-y-0.5 overflow-y-auto">
            {estados.map((estado) => (
              <li key={estado.uf || "sem-local"}>
                <ShareRow
                  label={estado.nome}
                  cents={estado.receitaCents}
                  pedidos={estado.pedidos}
                  total={totalCents}
                  pressed={estado.uf === active.uf}
                  onClick={() => setUf(estado.uf)}
                />
              </li>
            ))}
          </ul>
        </div>
        <div>
          <p className="px-2 type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">
            Cidades · {active.nome}
          </p>
          <ul className="mt-1 max-h-80 space-y-0.5 overflow-y-auto">
            {active.cidades.map((cidade) => (
              <li key={cidade.nome}>
                <ShareRow
                  label={cidade.nome}
                  cents={cidade.receitaCents}
                  pedidos={cidade.pedidos}
                  total={active.receitaCents}
                />
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

const GENERO = [
  { id: "f", label: "Mulheres", curto: "Mulheres", color: "var(--primary)" },
  { id: "m", label: "Homens", curto: "Homens", color: "var(--chart-spend)" },
  { id: "u", label: "Não identificado", curto: "Sem nome", color: "var(--chart-plan)" },
] as const;

function GenderRing({
  parts,
  total,
  leader,
}: {
  parts: Array<{ receitaCents: number; color: string }>;
  total: number;
  leader: { curto: string; share: number | null };
}) {
  const r = 40;
  const c = 2 * Math.PI * r;
  let offset = 0;
  return (
    <div className="relative h-full w-full">
      <svg viewBox="0 0 120 120" className="h-full w-full" aria-hidden>
        <circle cx="60" cy="60" r={r} fill="none" stroke="var(--divider-soft)" strokeWidth="14" />
        {parts.map((part, index) => {
          if (part.receitaCents <= 0 || total <= 0) return null;
          const len = (part.receitaCents / total) * c;
          const node = (
            <circle
              key={index}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={part.color}
              strokeWidth="14"
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
            />
          );
          offset += len;
          return node;
        })}
      </svg>
      <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center px-[22%] text-center">
        <span className="type-tagline tabular-nums text-[var(--foreground)]">{pct(leader.share)}</span>
        <span className="mt-1 type-fine-print text-[var(--muted-foreground)]">{leader.curto}</span>
      </div>
    </div>
  );
}

function Genero({ genero }: { genero: Comportamento["genero"] }) {
  const rows = GENERO.map((meta) => ({ ...meta, ...genero[meta.id] }));
  const total = rows.reduce((sum, row) => sum + row.receitaCents, 0);
  if (total <= 0) {
    return <p className="type-fine-print text-[var(--muted-foreground)]">Nenhuma venda paga no período.</p>;
  }
  const leader = [...rows].sort((a, b) => b.receitaCents - a.receitaCents)[0];
  const leaderShare = shareOf(leader.receitaCents, total);
  return (
    <div className="flex h-full min-h-0 flex-1 flex-col">
      <div className="flex min-h-0 flex-1 flex-col gap-5 lg:flex-row lg:items-stretch lg:gap-6">
        <div className="flex items-center justify-center lg:min-h-0 lg:min-w-0 lg:flex-[1.15] lg:[container-type:size]">
          <div className="aspect-square w-52 lg:w-[min(100cqw,100cqh)]">
            <GenderRing parts={rows} total={total} leader={{ curto: leader.curto, share: leaderShare }} />
          </div>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col justify-between gap-4 py-1">
          {rows.map((row) => {
            const share = shareOf(row.receitaCents, total) ?? 0;
            return (
              <li key={row.id} className="flex flex-col justify-center gap-1.5">
                <span className="flex items-center gap-2 type-caption text-[var(--foreground)]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: row.color }} aria-hidden />
                  {row.label}
                </span>
                <span className="flex items-baseline justify-between gap-3">
                  <span className="type-body tabular-nums text-[var(--foreground)]">{money(row.receitaCents)}</span>
                  <span className="type-fine-print text-[var(--muted-foreground)]">{pct(share)}</span>
                </span>
                <span className="flex h-2 overflow-hidden rounded-full bg-[var(--divider-soft)]">
                  <span
                    className="h-full rounded-full"
                    style={{ width: `${Math.max(share > 0 ? 2 : 0, Math.min(100, share))}%`, background: row.color }}
                  />
                </span>
                <span className="type-fine-print text-[var(--muted-foreground)]">
                  {num(row.pedidos)} {row.pedidos === 1 ? "pedido" : "pedidos"}
                </span>
              </li>
            );
          })}
        </ul>
      </div>
    </div>
  );
}

function ticketTone(now: number | null, before: number | null): "positive" | "negative" | undefined {
  if (now == null || before == null || before <= 0) return undefined;
  if (now >= before * 1.08) return "positive";
  if (now <= before * 0.92) return "negative";
  return undefined;
}

function Kpi({ label, value, hint, tone }: { label: string; value: string; hint?: string; tone?: "positive" | "negative" }) {
  const valueColor = tone === "positive" ? "text-positive" : tone === "negative" ? "text-negative" : "text-[var(--foreground)]";
  return (
    <div className="kpi-card-content rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4">
      <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{label}</p>
      <p className={`kpi-card-value mt-2 type-tagline tabular-nums ${valueColor}`}>{value}</p>
      {hint ? <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p> : null}
    </div>
  );
}

const chartTooltip = {
  contentStyle: {
    backgroundColor: "var(--card)",
    border: "1px solid var(--border)",
    borderRadius: "10px",
    color: "var(--foreground)",
    boxShadow: "none",
    padding: "10px 14px",
  },
  labelStyle: { color: "var(--foreground)", fontWeight: 600, marginBottom: 4 },
  itemStyle: { color: "var(--foreground)", fontSize: 13 },
};

function ReceitaChart({
  serie,
  agrupamento,
}: {
  serie: Comportamento["serie"];
  agrupamento: Comportamento["serieAgrupamento"];
}) {
  const isMobile = useIsMobile();
  const rows = serie.map((row) => {
    const [, month, day] = row.data.split("-");
    return {
      periodo: `${day}/${month}`,
      total: row.totalCents / 100,
      nova: row.primeiraCents / 100,
      recompra: row.recompraCents / 100,
    };
  });
  if (rows.length < 2 || rows.every((row) => row.total === 0)) return null;
  const tickEvery = isMobile ? mobileTickInterval(rows.length) : rows.length > 16 ? Math.ceil(rows.length / 16) - 1 : 0;
  const semanal = agrupamento === "semana";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">{semanal ? "Receita por semana" : "Receita por dia"}</p>
        <ul className="flex flex-wrap gap-3">
          <li className="inline-flex items-center gap-1.5 type-fine-print text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)] opacity-30" />
            Total
          </li>
          <li className="inline-flex items-center gap-1.5 type-fine-print text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
            Recompra
          </li>
          <li className="inline-flex items-center gap-1.5 type-fine-print text-[var(--muted-foreground)]">
            <span className="h-2 w-2 rounded-full bg-[var(--chart-revenue)]" />
            Nova
          </li>
        </ul>
      </div>
      <div className="mt-4 h-56">
        <ResponsiveContainer width="100%" height="100%">
          <ComposedChart data={rows}>
            <CartesianGrid vertical={false} stroke="var(--divider-soft)" />
            <XAxis dataKey="periodo" stroke="var(--muted-foreground)" fontSize={11} tickLine={false} axisLine={false} interval={tickEvery} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={11}
              tickLine={false}
              axisLine={false}
              width={48}
              tickFormatter={(value: number) => (value >= 1000 ? `${Math.round(value / 1000)} mil` : String(Math.round(value)))}
            />
            <Tooltip
              cursor={{ fill: "var(--divider-soft)" }}
              labelFormatter={(label: string) => (semanal ? `Semana de ${label}` : label)}
              formatter={(value: number, name: string) => [money(Math.round(Number(value) * 100)), name]}
              {...chartTooltip}
            />
            <Bar dataKey="total" name="Total" fill="var(--primary)" fillOpacity={0.18} radius={[4, 4, 0, 0]} />
            <Line type="monotone" dataKey="recompra" name="Recompra" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} />
            <Line type="monotone" dataKey="nova" name="Nova" stroke="var(--chart-revenue)" strokeWidth={2} dot={{ r: 3, strokeWidth: 0 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function Origens({ origens }: { origens: Comportamento["origens"] }) {
  const max = Math.max(1, ...origens.map((row) => row.receitaCents));
  return (
    <ul className="space-y-3">
      {origens.map((row) => {
        const share = Math.max(2, Math.round((row.receitaCents / max) * 100));
        return (
          <li key={row.id}>
            <span className="flex items-baseline justify-between gap-3">
              <span className="type-caption text-[var(--foreground)]">{row.label}</span>
              <span className="type-caption tabular-nums text-[var(--foreground)]">
                {money(row.receitaCents)}
                <span className="ml-2 text-[var(--muted-foreground)]">{pct(row.recompraPct)} voltou</span>
              </span>
            </span>
            <span className="mt-1.5 flex h-2 overflow-hidden rounded-full bg-[var(--divider-soft)]">
              <span className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${share}%` }} />
            </span>
            <span className="mt-1 block type-fine-print text-[var(--muted-foreground)]">
              {num(row.clientes)} {row.clientes === 1 ? "cliente" : "clientes"} · ticket {money(row.ticketCents)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

function Pares({ pares }: { pares: Comportamento["pares"] }) {
  return (
    <div>
      <div className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_4.5rem] gap-3 pb-2 type-fine-print text-[var(--muted-foreground)]">
        <span>Comprou</span>
        <span />
        <span>Depois</span>
        <span className="text-right">Clientes</span>
      </div>
      <ul className="divide-y divide-[var(--divider-soft)]">
        {pares.map((row, index) => (
          <li key={`${row.de}-${row.para}-${index}`} className="grid grid-cols-[minmax(0,1fr)_1.5rem_minmax(0,1fr)_4.5rem] items-center gap-3 py-2.5">
            <span className="truncate type-caption text-[var(--foreground)]" title={row.de}>
              {row.de}
            </span>
            <span className="type-caption text-[var(--muted-foreground)]" aria-hidden>
              →
            </span>
            <span className="truncate type-caption text-[var(--foreground)]" title={row.para}>
              {row.para}
            </span>
            <span className="text-right type-caption tabular-nums text-[var(--foreground)]">{num(row.compradores)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function ComportamentoSection({ clienteId, query }: { clienteId: string; query: string }) {
  const { data, isLoading, isPlaceholderData, isError } = useQuery({
    queryKey: ["cliente-comportamento", clienteId, query],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/comportamento?${query}`);
      if (!res.ok) throw new Error("Falha ao carregar comportamento");
      return (await res.json()) as Comportamento;
    },
    placeholderData: keepPreviousData,
  });

  if (isLoading || !data) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 type-caption text-[var(--muted-foreground)]">
        <Loader2 className="h-4 w-4 animate-spin" /> Lendo comportamento de compra…
      </div>
    );
  }

  if (isError) {
    return (
      <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5 type-caption text-[var(--muted-foreground)]">
        Não foi possível carregar o comportamento de compra.
      </div>
    );
  }

  const maxHeat = Math.max(1, ...data.heatmap.flat());
  const before = data.ticketsAnterior;

  return (
    <section className={`space-y-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      <div className="kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Receita nova" value={money(data.recompra.receitaPrimeiraCents)} hint={`${num(data.recompra.pedidosPrimeira)} pedidos`} />
        <Kpi label="Receita de recompra" value={money(data.recompra.receitaRecompraCents)} hint={`${num(data.recompra.pedidosRecompra)} pedidos`} />
        <Kpi label="Receita recorrente" value={pct(data.recompra.participacaoRecorrentesPct)} />
        <Kpi label="LTV" value={money(data.ltv.medioCents)} hint={`${num(data.ltv.compradores)} compradores`} />
      </div>

      <ReceitaChart serie={data.serie} agrupamento={data.serieAgrupamento} />

      <div className="kpi-grid grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Kpi label="Ticket do pedido" value={money(data.tickets.pedidoCents)} tone={ticketTone(data.tickets.pedidoCents, before.pedidoCents)} />
        <Kpi label="Ticket por cliente" value={money(data.tickets.porClienteCents)} tone={ticketTone(data.tickets.porClienteCents, before.porClienteCents)} />
        <Kpi label="Primeira compra" value={money(data.tickets.primeiraCents)} tone={ticketTone(data.tickets.primeiraCents, before.primeiraCents)} />
        <Kpi label="Ticket da recompra" value={money(data.tickets.recompraCents)} tone={ticketTone(data.tickets.recompraCents, before.recompraCents)} />
      </div>

      <Card title="Origem">
        {data.origens.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Nenhuma venda paga no período.</p>
        ) : (
          <Origens origens={data.origens} />
        )}
      </Card>

      <div className="grid gap-3 lg:grid-cols-2">
        <Card title="Top 10 compradores">
          {data.topCompradores.length === 0 ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum comprador identificado no período.</p>
          ) : (
            <ul className="divide-y divide-[var(--divider-soft)]">
              {data.topCompradores.map((row, index) => (
                <li key={`${row.nome}-${index}`} className="flex items-baseline justify-between gap-3 py-2">
                  <span className="type-caption text-[var(--foreground)]">{row.nome}</span>
                  <span className="type-caption tabular-nums text-[var(--foreground)]">
                    {money(row.receitaCents)}
                    <span className="ml-2 text-[var(--muted-foreground)]">{num(row.pedidos)} ped.</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Gênero" fill>
          <Genero genero={data.genero} />
        </Card>
      </div>

      <Card title="Produtos">
        {data.produtos.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum item no período.</p>
        ) : (
          <Produtos produtos={data.produtos} />
        )}
      </Card>

      <Card title="Depois comprou">
        {data.pares.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Ainda não há uma sequência com compradores suficientes.</p>
        ) : (
          <Pares pares={data.pares} />
        )}
      </Card>

      <Card title="Dia × hora">
        <div className="overflow-x-auto">
          <div
            className="grid min-w-[36rem] gap-1"
            style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}
          >
            <span />
            {Array.from({ length: 24 }, (_, hour) => (
              <span key={hour} className="text-center type-fine-print text-[var(--muted-foreground)]">
                {hour % 3 === 0 ? hour : ""}
              </span>
            ))}
            {DAYS.map((day, dayIndex) => (
              <div key={day} className="contents">
                <span className="type-fine-print text-[var(--muted-foreground)]">{day}</span>
                {data.heatmap[dayIndex].map((count, hour) => (
                  <span
                    key={`${day}-${hour}`}
                    title={`${day} ${hour}h · ${count} ${count === 1 ? "pedido" : "pedidos"}`}
                    className="aspect-square rounded-[2px]"
                    style={{
                      background:
                        count > 0
                          ? `color-mix(in srgb, var(--primary) ${Math.max(18, Math.round((count / maxHeat) * 100))}%, transparent)`
                          : "var(--divider-soft)",
                    }}
                  />
                ))}
              </div>
            ))}
          </div>
        </div>
      </Card>

      <Card title="Estados e cidades">
        {data.estados.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum pedido com local no período.</p>
        ) : (
          <Lugares estados={data.estados} />
        )}
      </Card>
    </section>
  );
}
