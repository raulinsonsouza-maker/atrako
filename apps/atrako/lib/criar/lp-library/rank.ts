export type LibraryCandidate = {
  id: string;
  kind: string;
  goal: string | null;
  html: string;
  css: string;
  tags: string[];
  score: number;
  status: string;
  sourceClienteId: string;
};

export type LibraryQuery = {
  clienteId: string;
  goal: "leads" | "sales";
  segmento?: string | null;
  estilo?: string | null;
  /** Orçamento de caracteres de html+css injetados no prompt. */
  budget?: number;
};

/**
 * Aprovadas (globais) e candidatas do próprio workspace.
 * No máximo uma seção por tipo, as de maior nota primeiro.
 */
export function rankSections(rows: LibraryCandidate[], query: LibraryQuery): LibraryCandidate[] {
  const pool = rows.filter(
    (row) => row.status === "approved" || (row.status === "candidate" && row.sourceClienteId === query.clienteId),
  );
  const needles = [query.segmento, query.estilo]
    .filter((v): v is string => Boolean(v))
    .flatMap((v) => v.toLowerCase().split(/[^a-z0-9áéíóúãõç]+/i))
    .filter((w) => w.length > 2);

  const scored = pool.map((row) => {
    let extra = row.goal === query.goal ? 2 : 0;
    const tags = row.tags.map((t) => t.toLowerCase());
    for (const word of needles) {
      if (tags.some((tag) => tag.includes(word))) extra += 1.5;
    }
    return { row, rank: row.score + extra };
  });
  scored.sort((a, b) => b.rank - a.rank || a.row.id.localeCompare(b.row.id));

  const seen = new Set<string>();
  const picked: LibraryCandidate[] = [];
  let used = 0;
  const budget = query.budget ?? 12_000;
  for (const { row } of scored) {
    if (seen.has(row.kind)) continue;
    const size = row.html.length + row.css.length;
    if (used + size > budget) continue;
    seen.add(row.kind);
    picked.push(row);
    used += size;
  }
  return picked;
}

export function libraryPromptBlock(rows: LibraryCandidate[]): string {
  if (!rows.length) return "";
  return rows
    .map(
      (row) =>
        `ID ${row.id} (${row.kind})\n${row.html}\n${row.css ? `CSS:\n${row.css}` : ""}`.trim(),
    )
    .join("\n\n");
}
