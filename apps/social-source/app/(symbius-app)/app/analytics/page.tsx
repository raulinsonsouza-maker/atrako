"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type AnalyticsData = {
  summary: {
    totalContatos: number;
    totalExecucoes: number;
    linkClicks: number;
    emailsCapturados: number;
    followsConfirmados: number;
    handoffs: number;
  };
  fluxos: Array<{
    id: string;
    nome: string;
    status: string;
    triggerType: string;
    execucoes: number;
  }>;
};

type AttributionSummary = {
  revenue: number;
  leads: number;
  customers: number;
  orders: number;
  averageTicket: number;
  spend: number;
  roas: number | null;
  model: string;
  byCampaign: Array<{
    campaign: string;
    source: string;
    medium: string;
    orders: number;
    revenue: number;
  }>;
};

type OrderRow = {
  transaction_id: string;
  value: number;
  currency: string;
  occurred_at: string;
  st_id: string | null;
  campaign: string | null;
  source: string | null;
};

function brl(n: number) {
  return n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function toInputDate(d: Date) {
  return d.toISOString().slice(0, 10);
}

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [attr, setAttr] = useState<AttributionSummary | null>(null);
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [model, setModel] = useState("first_touch");
  const [from, setFrom] = useState(() => {
    const d = new Date();
    d.setDate(d.getDate() - 30);
    return toInputDate(d);
  });
  const [to, setTo] = useState(() => toInputDate(new Date()));
  const [spendDate, setSpendDate] = useState(() => toInputDate(new Date()));
  const [spendValue, setSpendValue] = useState("");
  const [spendPlatform, setSpendPlatform] = useState("meta");
  const [spendCampaign, setSpendCampaign] = useState("");
  const [spendMsg, setSpendMsg] = useState<string | null>(null);
  const [selectedCampaign, setSelectedCampaign] = useState<string | null>(null);

  useEffect(() => {
    void fetch("/api/symbius/analytics")
      .then((r) => r.json())
      .then(setData);
  }, []);

  useEffect(() => {
    const qs = new URLSearchParams({
      model,
      from: new Date(from).toISOString(),
      to: new Date(`${to}T23:59:59`).toISOString(),
    });
    void fetch(`/api/symbius/attribution/summary?${qs}`)
      .then((r) => r.json())
      .then(setAttr);
    void fetch(`/api/symbius/attribution/orders?${qs}`)
      .then((r) => r.json())
      .then((d) => setOrders(d.orders ?? []));
  }, [model, from, to]);

  const filteredOrders = useMemo(() => {
    if (!selectedCampaign) return orders;
    return orders.filter(
      (o) => (o.campaign ?? "(sem campanha)") === selectedCampaign,
    );
  }, [orders, selectedCampaign]);

  async function saveSpend() {
    setSpendMsg(null);
    const spend = Number(spendValue.replace(",", "."));
    if (!Number.isFinite(spend)) {
      setSpendMsg("Valor inválido");
      return;
    }
    const res = await fetch("/api/symbius/attribution/spend", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        date: spendDate,
        platform: spendPlatform,
        campaignName: spendCampaign || undefined,
        spend,
      }),
    });
    if (!res.ok) {
      setSpendMsg("Falha ao salvar investimento");
      return;
    }
    setSpendMsg("Investimento salvo");
    setSpendValue("");
    const qs = new URLSearchParams({
      model,
      from: new Date(from).toISOString(),
      to: new Date(`${to}T23:59:59`).toISOString(),
    });
    const refreshed = await fetch(`/api/symbius/attribution/summary?${qs}`).then(
      (r) => r.json(),
    );
    setAttr(refreshed);
  }

  if (!data) {
    return (
      <div className="min-h-full bg-[#f0f2f5] p-10">
        <div className="h-8 w-48 animate-pulse rounded bg-zinc-200" />
        <div className="mt-6 grid gap-4 sm:grid-cols-3">
          {[1, 2, 3].map((i) => (
            <div key={i} className="h-24 animate-pulse rounded-2xl bg-zinc-200" />
          ))}
        </div>
      </div>
    );
  }

  const cards = [
    { label: "Contatos", value: data.summary.totalContatos },
    { label: "Execuções", value: data.summary.totalExecucoes },
    { label: "Cliques em link", value: data.summary.linkClicks },
    { label: "E-mails capturados", value: data.summary.emailsCapturados },
    { label: "Follows confirmados", value: data.summary.followsConfirmados },
    { label: "Handoffs", value: data.summary.handoffs },
  ];

  return (
    <div className="min-h-full bg-[#f0f2f5] p-6 text-zinc-900 md:p-10">
      <h1 className="text-2xl font-bold">Análises</h1>
      <p className="mt-1 text-zinc-500">Automações e receita atribuída</p>

      {attr && (
        <section className="mt-8">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold">Symbius Attribution</h2>
              <p className="text-sm text-zinc-500">Receita por origem do lead</p>
            </div>
            <div className="flex flex-wrap gap-2">
              <label className="text-xs text-zinc-500">
                De
                <input
                  type="date"
                  value={from}
                  onChange={(e) => setFrom(e.target.value)}
                  className="ml-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <label className="text-xs text-zinc-500">
                Até
                <input
                  type="date"
                  value={to}
                  onChange={(e) => setTo(e.target.value)}
                  className="ml-1 rounded-lg border border-zinc-200 bg-white px-2 py-1.5 text-sm"
                />
              </label>
              <select
                value={model}
                onChange={(e) => setModel(e.target.value)}
                className="rounded-lg border border-zinc-200 bg-white px-3 py-2 text-sm"
                aria-label="Modelo de atribuição"
              >
                <option value="first_touch">First touch</option>
                <option value="last_touch">Last touch</option>
                <option value="linear">Linear</option>
                <option value="position_based">Position based</option>
                <option value="time_decay">Time decay</option>
              </select>
            </div>
          </div>

          <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="symbius-card">
              <p className="text-sm text-zinc-500">Receita atribuída</p>
              <p className="mt-1 text-2xl font-bold">{brl(attr.revenue)}</p>
            </div>
            <div className="symbius-card">
              <p className="text-sm text-zinc-500">Leads</p>
              <p className="mt-1 text-2xl font-bold">{attr.leads}</p>
            </div>
            <div className="symbius-card">
              <p className="text-sm text-zinc-500">Clientes</p>
              <p className="mt-1 text-2xl font-bold">{attr.customers}</p>
            </div>
            <div className="symbius-card">
              <p className="text-sm text-zinc-500">Investimento</p>
              <p className="mt-1 text-2xl font-bold">{brl(attr.spend)}</p>
            </div>
            <div className="symbius-card">
              <p className="text-sm text-zinc-500">ROAS</p>
              <p className="mt-1 text-2xl font-bold">
                {attr.spend > 0 && attr.roas != null
                  ? `${attr.roas.toFixed(2)}x`
                  : "—"}
              </p>
              {attr.spend <= 0 ? (
                <p className="mt-1 text-xs text-zinc-400">
                  Informe o investimento abaixo
                </p>
              ) : null}
            </div>
          </div>

          <div className="mt-4 rounded-2xl border border-zinc-200 bg-white p-4">
            <h3 className="font-semibold">Registrar investimento (Ads)</h3>
            <div className="mt-3 flex flex-wrap gap-2">
              <input
                type="date"
                value={spendDate}
                onChange={(e) => setSpendDate(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
              <select
                value={spendPlatform}
                onChange={(e) => setSpendPlatform(e.target.value)}
                className="rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              >
                <option value="meta">Meta</option>
                <option value="google">Google</option>
                <option value="tiktok">TikTok</option>
              </select>
              <input
                value={spendCampaign}
                onChange={(e) => setSpendCampaign(e.target.value)}
                placeholder="Campanha (opcional)"
                className="min-w-[160px] flex-1 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
              <input
                value={spendValue}
                onChange={(e) => setSpendValue(e.target.value)}
                placeholder="R$ gasto"
                className="w-28 rounded-lg border border-zinc-200 px-3 py-2 text-sm"
              />
              <button
                type="button"
                onClick={() => void saveSpend()}
                className="symbius-btn-primary rounded-lg px-4 py-2 text-sm"
              >
                Salvar
              </button>
            </div>
            {spendMsg ? (
              <p className="mt-2 text-xs text-zinc-500">{spendMsg}</p>
            ) : null}
            <button
              type="button"
              className="mt-2 text-xs font-medium text-[#0084ff]"
              onClick={() => {
                void fetch("/api/symbius/attribution/spend-sync", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({ date: spendDate }),
                })
                  .then(async (r) => {
                    const d = await r.json();
                    setSpendMsg(
                      r.ok
                        ? `Meta sync: ${d.upserted ?? 0} campanhas`
                        : String(d.error ?? "Sync indisponível — use manual"),
                    );
                    if (r.ok) {
                      const qs = new URLSearchParams({
                        model,
                        from: new Date(from).toISOString(),
                        to: new Date(`${to}T23:59:59`).toISOString(),
                      });
                      const refreshed = await fetch(
                        `/api/symbius/attribution/summary?${qs}`,
                      ).then((x) => x.json());
                      setAttr(refreshed);
                    }
                  })
                  .catch(() => setSpendMsg("Falha no sync Meta"));
              }}
            >
              Tentar sync Meta Ads (se configurado)
            </button>
          </div>

          <div className="mt-6 symbius-card overflow-hidden p-0">
            <table className="w-full text-sm">
              <thead className="bg-zinc-50 text-zinc-600">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold">Campanha</th>
                  <th className="px-4 py-3 text-left font-semibold">Source</th>
                  <th className="px-4 py-3 text-right font-semibold">Pedidos</th>
                  <th className="px-4 py-3 text-right font-semibold">Receita</th>
                </tr>
              </thead>
              <tbody>
                {attr.byCampaign.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className="px-4 py-6 text-center text-zinc-500"
                    >
                      Nenhuma compra atribuída ainda. Envie POST /api/v1/purchases.
                    </td>
                  </tr>
                ) : (
                  attr.byCampaign.map((row) => (
                    <tr
                      key={`${row.source}-${row.medium}-${row.campaign}`}
                      className={`cursor-pointer border-t border-zinc-100 ${
                        selectedCampaign === row.campaign ? "bg-blue-50" : ""
                      }`}
                      onClick={() =>
                        setSelectedCampaign((c) =>
                          c === row.campaign ? null : row.campaign,
                        )
                      }
                    >
                      <td className="px-4 py-3 font-medium">{row.campaign}</td>
                      <td className="px-4 py-3 text-zinc-500">
                        {row.source} / {row.medium}
                      </td>
                      <td className="px-4 py-3 text-right">{row.orders}</td>
                      <td className="px-4 py-3 text-right font-semibold">
                        {brl(row.revenue)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          {selectedCampaign ? (
            <div className="mt-4 symbius-card overflow-hidden p-0">
              <div className="flex items-center justify-between border-b border-zinc-100 px-4 py-3">
                <h3 className="font-semibold">
                  Pedidos · {selectedCampaign}
                </h3>
                <button
                  type="button"
                  className="text-sm text-[#0084ff]"
                  onClick={() => setSelectedCampaign(null)}
                >
                  Limpar filtro
                </button>
              </div>
              <table className="w-full text-sm">
                <thead className="bg-zinc-50 text-zinc-600">
                  <tr>
                    <th className="px-4 py-2 text-left">Pedido</th>
                    <th className="px-4 py-2 text-left">st_id</th>
                    <th className="px-4 py-2 text-right">Valor</th>
                    <th className="px-4 py-2 text-right">Data</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredOrders.map((o) => (
                    <tr key={o.transaction_id} className="border-t border-zinc-100">
                      <td className="px-4 py-2 font-medium">
                        {o.transaction_id}
                      </td>
                      <td className="px-4 py-2 font-mono text-xs text-zinc-500">
                        {o.st_id ?? "—"}
                      </td>
                      <td className="px-4 py-2 text-right">{brl(o.value)}</td>
                      <td className="px-4 py-2 text-right text-zinc-500">
                        {new Date(o.occurred_at).toLocaleString("pt-BR")}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </section>
      )}

      <div className="mt-10 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <div key={c.label} className="symbius-card">
            <p className="text-sm text-zinc-500">{c.label}</p>
            <p className="mt-1 text-3xl font-bold">{c.value}</p>
          </div>
        ))}
      </div>

      <div className="mt-10 symbius-card overflow-hidden p-0">
        <table className="w-full text-sm">
          <thead className="bg-zinc-50 text-zinc-600">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Fluxo</th>
              <th className="px-4 py-3 text-left font-semibold">Gatilho</th>
              <th className="px-4 py-3 text-left font-semibold">Status</th>
              <th className="px-4 py-3 text-right font-semibold">Execuções</th>
            </tr>
          </thead>
          <tbody>
            {data.fluxos.map((f) => (
              <tr key={f.id} className="border-t border-zinc-100">
                <td className="px-4 py-3 font-medium">
                  <Link href={`/app/flows/${f.id}`} className="text-[#0084ff]">
                    {f.nome}
                  </Link>
                </td>
                <td className="px-4 py-3 text-zinc-500">{f.triggerType}</td>
                <td className="px-4 py-3">
                  {f.status === "PUBLISHED" ? "No ar" : f.status}
                </td>
                <td className="px-4 py-3 text-right font-semibold">
                  {f.execucoes}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
