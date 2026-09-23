export function GradientBars() {
  const primary = "#ff6a00";

  const COLORS: Record<string, string> = {
    Atendimento: "#3b82f6",
    Perdidos: "#ef4444",
    Visitas: "#f59e0b",
    Reservas: "#a855f7",
    Vendas: "#10b981",
    Leads: "#6b7280",
  };

  const groups = [
    {
      grupo: "Atendimento",
      count: 16,
      pct: 84,
      stages: [{ etapa: "Em Atendimento", count: 16, pct: 84 }],
    },
    {
      grupo: "Perdidos",
      count: 3,
      pct: 16,
      stages: [{ etapa: "Perdido", count: 3, pct: 16 }],
    },
  ];

  const totalLeads = 19;
  const totalGanhos = 0;
  const taxaFechamento = "0.0";

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "linear-gradient(160deg,#0e0e16 0%,#080810 100%)" }}
    >
      <div className="mx-auto max-w-xl space-y-5">
        <div className="flex items-center gap-2 mb-5">
          <div className="h-5 w-1 rounded-full" style={{ background: primary }} />
          <span
            className="text-[10px] font-bold uppercase tracking-[0.22em]"
            style={{ color: primary }}
          >
            CRM
          </span>
          <h2 className="text-lg font-extrabold tracking-tight text-white ml-1">
            Funil & Leads
          </h2>
        </div>

        <div
          className="grid grid-cols-3 divide-x rounded-2xl overflow-hidden"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.08)",
            divideColor: "rgba(255,255,255,0.08)",
          }}
        >
          {[
            { label: "Leads no período", value: String(totalLeads), color: "white" },
            { label: "Fechamentos", value: String(totalGanhos), color: "#10b981" },
            { label: "Taxa fechamento", value: `${taxaFechamento}%`, color: primary },
          ].map((k, i) => (
            <div key={i} className="py-4 px-4 text-center" style={{ borderColor: "rgba(255,255,255,0.08)" }}>
              <p className="text-[9px] font-semibold uppercase tracking-[0.2em] text-gray-500 mb-1">
                {k.label}
              </p>
              <p
                className="text-3xl font-black tabular-nums leading-none"
                style={{ color: k.color }}
              >
                {k.value}
              </p>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl overflow-hidden"
          style={{ border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div
            className="px-5 py-3 flex items-center gap-2"
            style={{ background: "rgba(255,255,255,0.04)", borderBottom: "1px solid rgba(255,255,255,0.06)" }}
          >
            <span className="text-[10px] font-bold uppercase tracking-[0.18em] text-gray-400">
              Distribuição por etapa
            </span>
            <div className="flex-1" />
            <span className="text-[10px] text-gray-600">{totalLeads} leads</span>
          </div>

          <div className="p-4 space-y-2" style={{ background: "rgba(255,255,255,0.015)" }}>
            <div className="flex h-8 rounded-xl overflow-hidden gap-0.5">
              {groups.map((g) => (
                <div
                  key={g.grupo}
                  className="relative flex items-center justify-center transition-all"
                  style={{
                    width: `${g.pct}%`,
                    background: `linear-gradient(90deg, ${COLORS[g.grupo]}cc, ${COLORS[g.grupo]}88)`,
                  }}
                >
                  {g.pct > 20 && (
                    <span className="text-[10px] font-bold text-white drop-shadow">
                      {g.pct}%
                    </span>
                  )}
                </div>
              ))}
            </div>

            <div className="flex gap-4 mt-2">
              {groups.map((g) => (
                <div key={g.grupo} className="flex items-center gap-1.5">
                  <span
                    className="h-2 w-2 rounded-sm"
                    style={{ background: COLORS[g.grupo] }}
                  />
                  <span className="text-[10px] text-gray-400">{g.grupo}</span>
                  <span
                    className="text-[10px] font-bold tabular-nums"
                    style={{ color: COLORS[g.grupo] }}
                  >
                    {g.count}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="space-y-3">
          {groups.map((g) => (
            <div
              key={g.grupo}
              className="rounded-2xl overflow-hidden"
              style={{ border: `1px solid ${COLORS[g.grupo]}25` }}
            >
              <div
                className="px-4 py-2.5 flex items-center justify-between"
                style={{
                  background: `linear-gradient(90deg, ${COLORS[g.grupo]}18, transparent)`,
                  borderBottom: `1px solid ${COLORS[g.grupo]}20`,
                }}
              >
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ background: COLORS[g.grupo] }}
                  />
                  <span
                    className="text-[11px] font-extrabold uppercase tracking-[0.16em]"
                    style={{ color: COLORS[g.grupo] }}
                  >
                    {g.grupo}
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div
                    className="flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums"
                    style={{
                      background: `${COLORS[g.grupo]}20`,
                      color: COLORS[g.grupo],
                    }}
                  >
                    {g.count} leads · {g.pct}%
                  </div>
                </div>
              </div>

              {g.stages.map((s) => (
                <div
                  key={s.etapa}
                  className="relative px-4 py-3 flex items-center gap-3 cursor-pointer"
                  style={{ background: "rgba(255,255,255,0.02)" }}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0"
                    style={{
                      width: `${s.pct}%`,
                      background: `linear-gradient(90deg, ${COLORS[g.grupo]}1a, transparent)`,
                    }}
                  />
                  <p className="relative flex-1 text-[13px] font-medium text-white">{s.etapa}</p>
                  <div className="relative shrink-0 flex items-center gap-3">
                    <div
                      className="h-1.5 rounded-full"
                      style={{
                        width: 80,
                        background: "rgba(255,255,255,0.06)",
                      }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${s.pct}%`,
                          background: `linear-gradient(90deg, ${COLORS[g.grupo]}, ${COLORS[g.grupo]}88)`,
                        }}
                      />
                    </div>
                    <span className="w-8 text-right text-[11px] tabular-nums text-gray-500">
                      {s.pct}%
                    </span>
                    <span
                      className="w-10 text-right text-sm font-extrabold tabular-nums"
                      style={{ color: COLORS[g.grupo] }}
                    >
                      {s.count}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </div>

        <div
          className="rounded-xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(16,185,129,0.06)",
            border: "1px solid rgba(16,185,129,0.15)",
          }}
        >
          <div className="h-1.5 w-1.5 rounded-full bg-emerald-400" />
          <p className="text-[11px] text-emerald-400/70">
            <span className="font-bold text-emerald-400">0 fechamentos</span> no período selecionado
            — pipeline ativo com {totalLeads} leads em andamento
          </p>
        </div>
      </div>
    </div>
  );
}
