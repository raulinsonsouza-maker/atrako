"use client";

import { useState, type ReactNode } from "react";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { ArrowRight, Loader2, ShoppingBag } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { orderStatusLabel } from "@/lib/commerce-attribution/order-status";
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
  topCompradores: Array<{
    id: string;
    nome: string;
    pedidos: number;
    receitaCents: number;
    compras: Array<{
      id: string;
      numero: string;
      em: string;
      cents: number;
      status: string | null;
      pagamento: string | null;
      parcelas: number | null;
      freteCents: number | null;
      freteMetodo: string | null;
      descontoCents: number;
      cupom: string | null;
      itens: Array<{ nome: string; quantidade: number; precoCents: number; imagem: string | null; url: string | null }>;
    }>;
  }>;
  produtos: Array<{ id: string; nome: string; quantidade: number; receitaCents: number; compradores: number; ticketCents: number | null; recompras: number; imageUrl: string | null; productUrl: string | null }>;
  facetas?: {
    genero: Comportamento["genero"];
    produtos: Comportamento["produtos"];
    heatmap: number[][];
    estados: Comportamento["estados"];
  };
  pares: Array<{ de: string; para: string; compradores: number; deImagem: string | null; paraImagem: string | null }>;
  serie: Array<{ data: string; totalCents: number; primeiraCents: number; recompraCents: number }>;
  serieAgrupamento: "dia" | "semana" | "mes";
  heatmap: number[][];
  genero: { f: Money; m: Money; u: Money };
  estados: Array<{ uf: string; nome: string; pedidos: number; receitaCents: number; cidades: Array<{ nome: string; pedidos: number; receitaCents: number }> }>;
};

const DAYS = ["Seg", "Ter", "Qua", "Qui", "Sex", "Sáb", "Dom"];
const MESES = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const MESES_LONG = ["Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho", "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"];
const money = (cents: number | null | undefined) =>
  cents == null ? "—" : (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const num = (n: number) => n.toLocaleString("pt-BR");
const pct = (n: number | null | undefined) => (n == null ? "—" : `${n.toLocaleString("pt-BR")}%`);

function ProductPhoto({ src, size = "lg" }: { src: string | null; size?: "lg" | "sm" }) {
  const [failed, setFailed] = useState(false);
  const box = size === "sm" ? "h-12 w-12" : "h-20 w-20";
  const icon = size === "sm" ? "h-4 w-4" : "h-5 w-5";
  if (!src || failed) {
    return (
      <span className={`flex ${box} shrink-0 items-center justify-center rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] text-[var(--muted-foreground)]`}>
        <ShoppingBag className={icon} strokeWidth={1.5} />
      </span>
    );
  }
  return (
    <span className={`flex ${box} shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] bg-[var(--canvas-parchment)] shadow-product`}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img src={src} alt="" onError={() => setFailed(true)} className="h-full w-full object-contain" />
    </span>
  );
}

function Produtos({
  produtos,
  selecionado,
  onSelect,
}: {
  produtos: Comportamento["produtos"];
  selecionado: string | null;
  onSelect: (id: string) => void;
}) {
  const max = Math.max(1, ...produtos.map((p) => p.receitaCents));
  return (
    <ul className="space-y-2">
      {produtos.map((row) => {
        const share = Math.max(2, Math.round((row.receitaCents / max) * 100));
        const ativo = row.id === selecionado;
        const nome = <span className="line-clamp-2 type-caption text-[var(--foreground)]">{row.nome}</span>;
        return (
          <li key={row.id}>
            <button
              type="button"
              onClick={() => onSelect(row.id)}
              aria-pressed={ativo}
              className={`flex w-full items-center gap-3 rounded-[var(--radius-xs)] px-2 py-2 text-left active:scale-[0.99] ${ativo ? "bg-[var(--divider-soft)]" : ""}`}
            >
            <ProductPhoto src={row.imageUrl} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline justify-between gap-3">
                {nome}
                <span className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">{money(row.receitaCents)}</span>
              </div>
              <span className="mt-0.5 block type-fine-print text-[var(--muted-foreground)]">
                {num(row.quantidade)} un. · {num(row.compradores)} {row.compradores === 1 ? "comprador" : "compradores"} · ticket {money(row.ticketCents)}
                {row.recompras > 0 ? ` · ${num(row.recompras)} ${row.recompras === 1 ? "voltou" : "voltaram"}` : ""}
              </span>
              <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--divider-soft)]">
                <div className="h-full rounded-full bg-[var(--primary)]" style={{ width: `${share}%` }} />
              </div>
            </div>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

function Card({ title, hint, children, fill = false }: { title?: string; hint?: string; children: ReactNode; fill?: boolean }) {
  return (
    <div className={`rounded-2xl border border-[var(--border)] bg-[var(--card)] p-4 ${fill ? "flex min-h-0 flex-col" : ""}`}>
      {title ? <p className="type-fine-print uppercase tracking-[0.18em] text-[var(--muted-foreground)]">{title}</p> : null}
      {hint ? <p className="mt-1 type-fine-print text-[var(--muted-foreground)]">{hint}</p> : null}
      <div className={title || hint ? (fill ? "mt-3 flex min-h-0 flex-1 flex-col" : "mt-3") : fill ? "flex min-h-0 flex-1 flex-col" : ""}>{children}</div>
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

function Lugares({
  estados,
  uf,
  cidade,
  onUf,
  onCidade,
}: {
  estados: Estado[];
  uf: string | null;
  cidade: string | null;
  onUf: (uf: string) => void;
  onCidade: (cidade: string, uf: string) => void;
}) {
  const [aberto, setAberto] = useState<string | null>(null);
  const totalCents = estados.reduce((s, e) => s + e.receitaCents, 0);
  const active = estados.find((e) => e.uf === (uf ?? aberto)) ?? estados[0];
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
                  pressed={uf == null ? undefined : uf === estado.uf}
                  onClick={() => {
                    setAberto(estado.uf);
                    onUf(estado.uf);
                  }}
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
            {active.cidades.map((item) => (
              <li key={item.nome}>
                <ShareRow
                  label={item.nome}
                  cents={item.receitaCents}
                  pedidos={item.pedidos}
                  total={active.receitaCents}
                  pressed={cidade == null ? undefined : cidade === item.nome && uf === active.uf}
                  onClick={() => onCidade(item.nome, active.uf)}
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
  selecionado,
  onSelect,
}: {
  parts: Array<{ id: string; receitaCents: number; color: string }>;
  total: number;
  leader: { curto: string; share: number | null };
  selecionado: string | null;
  onSelect: (id: "f" | "m" | "u") => void;
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
              key={part.id}
              cx="60"
              cy="60"
              r={r}
              fill="none"
              stroke={part.color}
              strokeWidth={selecionado === part.id ? 18 : 14}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform="rotate(-90 60 60)"
              className="cursor-pointer"
              onClick={() => onSelect(part.id as "f" | "m" | "u")}
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

function Genero({
  genero,
  selecionado,
  onSelect,
}: {
  genero: Comportamento["genero"];
  selecionado: "f" | "m" | "u" | null;
  onSelect: (id: "f" | "m" | "u") => void;
}) {
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
            <GenderRing parts={rows} total={total} leader={{ curto: leader.curto, share: leaderShare }} selecionado={selecionado} onSelect={onSelect} />
          </div>
        </div>
        <ul className="flex min-w-0 flex-1 flex-col justify-between gap-4 py-1">
          {rows.map((row) => {
            const share = shareOf(row.receitaCents, total) ?? 0;
            return (
              <li key={row.id}>
                <button
                  type="button"
                  onClick={() => onSelect(row.id)}
                  aria-pressed={selecionado === row.id}
                  className={`flex w-full flex-col justify-center gap-1.5 rounded-[var(--radius-xs)] px-2 py-1.5 text-left active:scale-[0.99] ${selecionado === row.id ? "bg-[var(--divider-soft)]" : ""}`}
                >
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
                </button>
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
  const years = new Set(serie.map((row) => row.data.slice(0, 4)));
  const multiYear = years.size > 1;
  const rows = serie.map((row) => {
    const [year, month, day] = row.data.split("-");
    const mes = MESES[Number(month) - 1] ?? month;
    const periodo =
      agrupamento === "mes" ? (multiYear ? `${mes}/${year.slice(2)}` : mes) : `${day}/${month}`;
    return {
      periodo,
      rotulo:
        agrupamento === "mes"
          ? `${MESES_LONG[Number(month) - 1] ?? month} ${year}`
          : agrupamento === "semana"
            ? `Semana de ${day}/${month}`
            : `${day}/${month}`,
      total: row.totalCents / 100,
      nova: row.primeiraCents / 100,
      recompra: row.recompraCents / 100,
    };
  });
  if (rows.length < 2 || rows.every((row) => row.total === 0)) return null;
  const tickEvery = isMobile ? mobileTickInterval(rows.length) : rows.length > 16 ? Math.ceil(rows.length / 16) - 1 : 0;
  const titulo = agrupamento === "mes" ? "Receita por mês" : agrupamento === "semana" ? "Receita por semana" : "Receita por dia";
  return (
    <div className="rounded-2xl border border-[var(--border)] bg-[var(--card)] p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="type-caption-strong text-[var(--foreground)]">{titulo}</p>
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
              labelFormatter={(_label: string, payload: ReadonlyArray<{ payload?: { rotulo?: string } }>) =>
                payload[0]?.payload?.rotulo ?? _label
              }
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

function peakHour(row: number[]) {
  const max = Math.max(0, ...row);
  if (max <= 0) return -1;
  const hours = row.flatMap((count, hour) => (count === max ? [hour] : []));
  return hours[Math.floor((hours.length - 1) / 2)] ?? -1;
}

function Heatmap({
  heatmap,
  dia,
  hora,
  onSelect,
}: {
  heatmap: number[][];
  dia: number | null;
  hora: number | null;
  onSelect: (dia: number, hora: number) => void;
}) {
  const maxHeat = Math.max(1, ...heatmap.flat());
  const dayTotals = heatmap.map((row) => row.reduce((sum, count) => sum + count, 0));
  const maxDay = Math.max(1, ...dayTotals);
  const peaks = heatmap.map(peakHour);
  return (
    <div className="overflow-x-auto">
      <div className="grid min-w-[36rem] gap-1" style={{ gridTemplateColumns: "2.5rem repeat(24, minmax(0, 1fr))" }}>
        <span />
        {Array.from({ length: 24 }, (_, hour) => (
          <span key={hour} className="text-center type-fine-print text-[var(--muted-foreground)]">
            {hour % 3 === 0 ? hour : ""}
          </span>
        ))}
        {DAYS.map((day, dayIndex) => (
          <div key={day} className="contents">
            <span
              className="type-fine-print text-[var(--foreground)]"
              style={{ opacity: 0.4 + 0.6 * (dayTotals[dayIndex] / maxDay) }}
            >
              {day}
            </span>
            {heatmap[dayIndex].map((count, hour) => {
              const dayMax = Math.max(1, ...heatmap[dayIndex]);
              const local = count / dayMax;
              const global = count / maxHeat;
              const isPeak = hour === peaks[dayIndex];
              const ativo = dia === dayIndex && hora === hour;
              const shaped = count <= 0 ? 0 : local >= 0.45 ? 0.4 + 0.6 * Math.sqrt(global) : global * 0.28;
              return (
                <button
                  type="button"
                  key={`${day}-${hour}`}
                  title={`${day} ${hour}h · ${count} ${count === 1 ? "pedido" : "pedidos"}`}
                  aria-pressed={ativo}
                  onClick={() => onSelect(dayIndex, hour)}
                  className="relative aspect-square rounded-[2px] border-0 p-0"
                  style={{
                    background:
                      count > 0
                        ? `color-mix(in srgb, var(--primary) ${Math.round(shaped * 100)}%, transparent)`
                        : "var(--divider-soft)",
                    boxShadow: ativo
                      ? "inset 0 0 0 2px var(--foreground)"
                      : isPeak
                        ? "inset 0 0 0 1.5px var(--foreground)"
                        : undefined,
                  }}
                />
              );
            })}
          </div>
        ))}
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

function ParProduto({ nome, src }: { nome: string; src: string | null }) {
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <ProductPhoto src={src} size="sm" />
      <span className="line-clamp-2 type-caption text-[var(--foreground)]" title={nome}>
        {nome}
      </span>
    </span>
  );
}

function Pares({ pares }: { pares: Comportamento["pares"] }) {
  return (
    <ul className="space-y-4">
      {pares.map((row, index) => (
        <li key={`${row.de}-${row.para}-${index}`} className="grid grid-cols-[minmax(0,1fr)_1.25rem_minmax(0,1fr)_2rem] items-center gap-3">
          <ParProduto nome={row.de} src={row.deImagem} />
          <ArrowRight className="h-4 w-4 text-[var(--muted-foreground)]" strokeWidth={1.5} aria-hidden />
          <ParProduto nome={row.para} src={row.paraImagem} />
          <span className="text-right type-caption tabular-nums text-[var(--foreground)]">{num(row.compradores)}</span>
        </li>
      ))}
    </ul>
  );
}

type Filtro = { genero?: "f" | "m" | "u"; produto?: string; dia?: number; hora?: number; uf?: string; cidade?: string };

function filtroQuery(base: string, filtro: Filtro) {
  const params = new URLSearchParams(base);
  if (filtro.genero) params.set("genero", filtro.genero);
  if (filtro.produto) params.set("produto", filtro.produto);
  if (filtro.dia != null) params.set("dia", String(filtro.dia));
  if (filtro.hora != null) params.set("hora", String(filtro.hora));
  if (filtro.uf != null) params.set("uf", filtro.uf);
  if (filtro.cidade) params.set("cidade", filtro.cidade);
  return params.toString();
}

function PedidoNoCard({ compra }: { compra: Comportamento["topCompradores"][number]["compras"][number] }) {
  const quando = compra.em
    ? new Date(compra.em).toLocaleString("pt-BR", { dateStyle: "medium", timeStyle: "short", timeZone: "America/Sao_Paulo" })
    : "Sem data";
  const status = orderStatusLabel(compra.status);
  const freteGratis = compra.freteCents === 0;
  const pagamento = compra.pagamento
    ? `Pago com ${compra.pagamento}${compra.parcelas ? ` em ${compra.parcelas}x` : ""}`
    : null;
  return (
    <div className="space-y-3 border-t border-[var(--divider-soft)] pt-3">
      <div>
        <p className="type-caption-strong text-[var(--foreground)]">Pedido #{compra.numero}</p>
        <p className="type-fine-print text-[var(--muted-foreground)]">
          {quando}
          {status ? ` · ${status}` : ""}
        </p>
      </div>
      <ul className="space-y-3">
        {compra.itens.map((item, index) => (
          <li key={`${item.nome}-${index}`} className="flex items-center gap-3">
            <ProductPhoto src={item.imagem} size="sm" />
            <div className="min-w-0 flex-1">
              <p className="line-clamp-2 type-caption text-[var(--foreground)]">{item.nome}</p>
              <p className="type-fine-print tabular-nums text-[var(--muted-foreground)]">
                {Math.max(1, item.quantidade)}× {item.precoCents > 0 ? money(item.precoCents) : ""}
              </p>
            </div>
            {item.precoCents > 0 ? (
              <p className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">
                {money(item.precoCents * Math.max(1, item.quantidade))}
              </p>
            ) : null}
          </li>
        ))}
      </ul>
      <div className="space-y-1 border-t border-[var(--divider-soft)] pt-3">
        {compra.freteCents != null ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="min-w-0 truncate type-caption text-[var(--muted-foreground)]">
              {compra.freteMetodo ? `Frete · ${compra.freteMetodo}` : "Frete"}
            </p>
            <p className="shrink-0 type-caption tabular-nums text-[var(--foreground)]">{freteGratis ? "Grátis" : money(compra.freteCents)}</p>
          </div>
        ) : null}
        {compra.descontoCents > 0 ? (
          <div className="flex items-baseline justify-between gap-3">
            <p className="type-caption text-[var(--muted-foreground)]">{compra.cupom ? `Cupom ${compra.cupom}` : "Desconto"}</p>
            <p className="type-caption tabular-nums text-[var(--foreground)]">−{money(compra.descontoCents)}</p>
          </div>
        ) : null}
        <div className="flex items-baseline justify-between gap-3">
          <p className="type-caption text-[var(--muted-foreground)]">Total</p>
          <p className="type-body-strong tabular-nums text-[var(--foreground)]">{money(compra.cents)}</p>
        </div>
      </div>
      {pagamento ? <p className="type-fine-print text-[var(--muted-foreground)]">{pagamento}</p> : null}
    </div>
  );
}

export function ComportamentoSection({ clienteId, query }: { clienteId: string; query: string }) {
  const [filtro, setFiltro] = useState<Filtro>({});
  const [rotulos, setRotulos] = useState<{ produto?: string; lugar?: string }>({});
  const [comprador, setComprador] = useState<Comportamento["topCompradores"][number] | null>(null);
  const pedido = filtroQuery(query, filtro);
  const { data, isLoading, isPlaceholderData, isError } = useQuery({
    queryKey: ["cliente-comportamento", clienteId, pedido],
    queryFn: async () => {
      const res = await fetch(`/api/clientes/${clienteId}/comportamento?${pedido}`);
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

  const before = data.ticketsAnterior;
  const generoVisao = data.facetas?.genero ?? data.genero;
  const produtosVisao = data.facetas?.produtos ?? data.produtos;
  const heatmapVisao = data.facetas?.heatmap ?? data.heatmap;
  const estadosVisao = data.facetas?.estados ?? data.estados;
  const produtoNome = rotulos.produto ?? produtosVisao.find((row) => row.id === filtro.produto)?.nome;
  const estadoNome = rotulos.lugar ?? estadosVisao.find((row) => row.uf === filtro.uf)?.nome;
  const chips: Array<{ id: string; label: string; off: () => void }> = [];
  if (filtro.genero) {
    chips.push({
      id: "genero",
      label: GENERO.find((row) => row.id === filtro.genero)?.label ?? filtro.genero,
      off: () => setFiltro((atual) => ({ ...atual, genero: undefined })),
    });
  }
  if (filtro.produto) {
    chips.push({
      id: "produto",
      label: produtoNome ?? "Produto",
      off: () => setFiltro((atual) => ({ ...atual, produto: undefined })),
    });
  }
  if (filtro.dia != null && filtro.hora != null) {
    chips.push({
      id: "horario",
      label: `${DAYS[filtro.dia] ?? ""} ${filtro.hora}h`,
      off: () => setFiltro((atual) => ({ ...atual, dia: undefined, hora: undefined })),
    });
  }
  if (filtro.uf != null) {
    chips.push({
      id: "lugar",
      label: estadoNome ?? "Sem local",
      off: () => setFiltro((atual) => ({ ...atual, uf: undefined, cidade: undefined })),
    });
  }

  return (
    <section className={`space-y-4 transition-opacity ${isPlaceholderData ? "opacity-60" : ""}`}>
      {chips.length > 0 ? (
        <div className="flex flex-wrap gap-2">
          {chips.map((chip) => (
            <button
              key={chip.id}
              type="button"
              onClick={chip.off}
              className="rounded-[var(--radius-xs)] bg-[var(--card)] px-2.5 py-1 type-fine-print text-[var(--foreground)] active:scale-95"
            >
              {chip.label} ×
            </button>
          ))}
        </div>
      ) : null}
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
        <Card title={comprador ? undefined : "Top 10 compradores"}>
          {comprador ? (
            <div>
              <BackLink onClick={() => setComprador(null)} />
              <p className="mt-3 type-caption-strong text-[var(--foreground)]">{comprador.nome}</p>
              <div className="mt-1 max-h-80 space-y-4 overflow-y-auto pr-1">
                {comprador.compras.map((compra) => (
                  <PedidoNoCard key={compra.id} compra={compra} />
                ))}
              </div>
            </div>
          ) : data.topCompradores.length === 0 ? (
            <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum comprador identificado no período.</p>
          ) : (
            <ul className="divide-y divide-[var(--divider-soft)]">
              {data.topCompradores.map((row) => (
                <li key={row.id}>
                  <button
                    type="button"
                    onClick={() => setComprador(row)}
                    className="flex w-full items-baseline justify-between gap-3 py-2 text-left active:scale-[0.99]"
                  >
                    <span className="type-caption text-[var(--foreground)]">{row.nome}</span>
                    <span className="type-caption tabular-nums text-[var(--foreground)]">
                      {money(row.receitaCents)}
                      <span className="ml-2 text-[var(--muted-foreground)]">{num(row.pedidos)} ped.</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </Card>

        <Card title="Gênero" fill>
          <Genero
            genero={generoVisao}
            selecionado={filtro.genero ?? null}
            onSelect={(id) => setFiltro((atual) => ({ ...atual, genero: atual.genero === id ? undefined : id }))}
          />
        </Card>
      </div>

      <Card title="Produtos">
        {produtosVisao.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum item no período.</p>
        ) : (
          <Produtos
            produtos={produtosVisao}
            selecionado={filtro.produto ?? null}
            onSelect={(id) => {
              const nome = produtosVisao.find((row) => row.id === id)?.nome;
              setRotulos((atual) => ({ ...atual, produto: nome }));
              setFiltro((atual) => ({ ...atual, produto: atual.produto === id ? undefined : id }));
            }}
          />
        )}
      </Card>

      <Card title="Comportamento de recompra">
        {data.pares.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Ainda não há uma sequência com compradores suficientes.</p>
        ) : (
          <Pares pares={data.pares} />
        )}
      </Card>

      <Card title="Dia × hora">
        <Heatmap
          heatmap={heatmapVisao}
          dia={filtro.dia ?? null}
          hora={filtro.hora ?? null}
          onSelect={(dia, hora) =>
            setFiltro((atual) =>
              atual.dia === dia && atual.hora === hora ? { ...atual, dia: undefined, hora: undefined } : { ...atual, dia, hora },
            )
          }
        />
      </Card>

      <Card title="Estados e cidades">
        {estadosVisao.length === 0 ? (
          <p className="type-fine-print text-[var(--muted-foreground)]">Nenhum pedido com local no período.</p>
        ) : (
          <Lugares
            estados={estadosVisao}
            uf={filtro.uf ?? null}
            cidade={filtro.cidade ?? null}
            onUf={(uf) => {
              const nome = estadosVisao.find((row) => row.uf === uf)?.nome ?? "Sem local";
              setRotulos((atual) => ({ ...atual, lugar: nome }));
              setFiltro((atual) => (atual.uf === uf && !atual.cidade ? { ...atual, uf: undefined } : { ...atual, uf, cidade: undefined }));
            }}
            onCidade={(nome, uf) => {
              const estado = estadosVisao.find((row) => row.uf === uf)?.nome ?? uf;
              const limpando = filtro.cidade === nome && filtro.uf === uf;
              setRotulos((atual) => ({ ...atual, lugar: limpando ? estado : `${estado} · ${nome}` }));
              setFiltro((atual) => (limpando ? { ...atual, cidade: undefined } : { ...atual, uf, cidade: nome }));
            }}
          />
        )}
      </Card>
    </section>
  );
}
