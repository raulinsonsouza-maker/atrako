export function DonutCards() {
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

  const r = 52;
  const cx = 72;
  const cy = 72;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const slices = groups.map((g) => {
    const dash = (g.pct / 100) * circumference;
    const gap = circumference - dash;
    const slice = { ...g, dash, gap, offset };
    offset += dash;
    return slice;
  });

  return (
    <div
      className="min-h-screen p-6"
      style={{ background: "linear-gradient(180deg,#0d0d14 0%,#0a0a0f 100%)" }}
    >
      <div className="mx-auto max-w-xl space-y-4">
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

        <div className="grid grid-cols-3 gap-3">
          {[
            { label: "Leads no período", value: totalLeads, color: "white", sub: "Jun 2026" },
            { label: "Fechamentos", value: totalGanhos, color: "#10b981", sub: "Negócios ganhos" },
            { label: "Taxa de fechamento", value: `${taxaFechamento}%`, color: primary, sub: "Conversão geral" },
          ].map((kpi) => (
            <div
              key={kpi.label}
              className="rounded-2xl p-4 flex flex-col gap-1"
              style={{
                background: "rgba(255,255,255,0.04)",
                border: "1px solid rgba(255,255,255,0.08)",
              }}
            >
              <p className="text-[9px] font-semibold uppercase tracking-[0.18em] text-gray-500">
                {kpi.label}
              </p>
              <p
                className="text-2xl font-extrabold tabular-nums leading-none"
                style={{ color: kpi.color }}
              >
                {kpi.value}
              </p>
              <p className="text-[10px] text-gray-600">{kpi.sub}</p>
            </div>
          ))}
        </div>

        <div
          className="rounded-2xl p-5 flex gap-6 items-center"
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
          }}
        >
          <div className="shrink-0 relative" style={{ width: 144, height: 144 }}>
            <svg width={144} height={144}>
              <circle
                cx={cx}
                cy={cy}
                r={r}
                fill="none"
                stroke="rgba(255,255,255,0.06)"
                strokeWidth={14}
              />
              {slices.map((s) => (
                <circle
                  key={s.grupo}
                  cx={cx}
                  cy={cy}
                  r={r}
                  fill="none"
                  stroke={COLORS[s.grupo]}
                  strokeWidth={14}
                  strokeDasharray={`${s.dash} ${s.gap}`}
                  strokeDashoffset={-s.offset + circumference * 0.25}
                  strokeLinecap="butt"
                />
              ))}
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <p className="text-2xl font-extrabold text-white">{totalLeads}</p>
              <p className="text-[10px] text-gray-500 uppercase tracking-wide">leads</p>
            </div>
          </div>

          <div className="flex-1 space-y-3">
            {groups.map((g) => (
              <div key={g.grupo} className="space-y-1">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span
                      className="h-2.5 w-2.5 rounded-full"
                      style={{ background: COLORS[g.grupo] }}
                    />
                    <span className="text-[11px] font-bold text-white">{g.grupo}</span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      className="text-sm font-extrabold tabular-nums"
                      style={{ color: COLORS[g.grupo] }}
                    >
                      {g.count}
                    </span>
                    <span className="text-[10px] text-gray-500">{g.pct}%</span>
                  </div>
                </div>
                <div
                  className="h-1.5 w-full rounded-full overflow-hidden"
                  style={{ background: "rgba(255,255,255,0.06)" }}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${g.pct}%`,
                      background: COLORS[g.grupo],
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="space-y-2">
          {groups.map((g) => (
            <div key={g.grupo} className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span
                  className="h-1.5 w-1.5 rounded-full"
                  style={{ background: COLORS[g.grupo] }}
                />
                <span
                  className="text-[10px] font-bold uppercase tracking-[0.14em]"
                  style={{ color: COLORS[g.grupo] }}
                >
                  {g.grupo}
                </span>
                <div className="h-px flex-1" style={{ background: "rgba(255,255,255,0.06)" }} />
              </div>
              {g.stages.map((s) => (
                <div
                  key={s.etapa}
                  className="group relative overflow-hidden rounded-xl px-4 py-3 cursor-pointer transition-all"
                  style={{
                    background: "rgba(255,255,255,0.03)",
                    border: `1px solid rgba(255,255,255,0.07)`,
                  }}
                >
                  <div
                    className="pointer-events-none absolute inset-y-0 left-0 rounded-l-xl transition-all"
                    style={{
                      width: `${s.pct}%`,
                      background: `linear-gradient(90deg, ${COLORS[g.grupo]}22, transparent)`,
                      borderLeft: `2px solid ${COLORS[g.grupo]}`,
                    }}
                  />
                  <div className="relative flex items-center gap-3">
                    <p className="flex-1 text-[13px] font-medium text-white">{s.etapa}</p>
                    <span className="text-[11px] tabular-nums text-gray-500">{s.pct}%</span>
                    <span
                      className="w-10 text-right text-sm font-bold tabular-nums"
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
      </div>
    </div>
  );
}
