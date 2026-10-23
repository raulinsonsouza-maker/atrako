const fs = require('fs');
const p = 'c:/Users/Raul/Desktop/Atrako/apps/atrako/components/relatorios/VendasMetaReport.tsx';
let s = fs.readFileSync(p, 'utf8');
const start = s.indexOf('          <div className="flex flex-col gap-3">');
const end = s.indexOf('          </div>\n        ) : (');
const newBlock = `          <div className="flex flex-col gap-3">
            {report.pedidos.map((p) => (
              <div key={p.id} className="rounded-[var(--radius-xs)] border border-[var(--line-soft)] bg-[var(--surface)] p-3">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className="type-caption-strong text-[var(--ink)]">#{p.numero} · {p.comprador ?? "—"}</p>
                    <p className="type-fine-print text-[var(--ink-muted-48)]">{formatDateTimeBR(p.data)}{p.cidade || p.uf ? " · " + [p.cidade, p.uf].filter(Boolean).join(" / ") : ""}</p>
                  </div>
                  <div className="text-right">
                    <p className="type-caption-strong tabular-nums text-[var(--ink)]">{formatBRL(p.totalCents)}</p>
                    <p className="type-fine-print tabular-nums text-[var(--primary)]">Comissão {formatBRL(p.comissaoCents)}</p>
                  </div>
                </div>
                <div className="mt-2 flex flex-col gap-1">
                  {p.itens.length ? p.itens.map((i, idx) => (
                    <p key={idx} className="type-fine-print text-[var(--ink)] break-words">{i.quantidade}× {i.titulo}</p>
                  )) : <p className="type-fine-print text-[var(--ink-muted-48)]">—</p>}
                </div>
                <p className="mt-2 type-micro-legal text-[var(--ink-muted-48)] break-words">
                  {p.campanha ?? "Campanha não identificada"}
                  {p.anuncio || p.conjunto ? " · " + [p.conjunto, p.anuncio].filter(Boolean).join(" · ") : ""}
                </p>
              </div>
            ))}
            <div className="flex items-center justify-between rounded-[var(--radius-xs)] bg-[var(--surface-2)] px-3 py-2">
              <span className="type-caption-strong text-[var(--ink)]">Total do ciclo</span>
              <span className="type-caption-strong tabular-nums text-[var(--primary)]">{formatBRL(r.faturamentoCents)} · Comissão {formatBRL(r.comissaoCents)}</span>
            </div>
          </div>
`;
s = s.slice(0, start) + newBlock + s.slice(end);
fs.writeFileSync(p, s);
console.log('done');
"