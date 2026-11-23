/**
 * Tipos/defaults de motivos manuais — seguro para client components.
 */

export type ManualLostReasonItem = { id: string; label: string };

export const DEFAULT_MANUAL_LOST_REASONS: ManualLostReasonItem[] = [
  { id: "preco", label: "Preço" },
  { id: "sem_fit", label: "Sem fit" },
  { id: "concorrente", label: "Concorrente" },
  { id: "sem_resposta", label: "Sem resposta" },
];

/** Ids usados por automações — não podem ser criados no editor. */
export const RESERVED_LOST_REASON_IDS = new Set([
  "pedido_nao_pago",
  "carrinho_expirado",
  "contato_invalido",
  "reembolso",
]);

export const MANUAL_LOST_REASONS_MIN = 1;
export const MANUAL_LOST_REASONS_MAX = 12;
export const MANUAL_LOST_LABEL_MAX = 60;

function asRecord(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? (v as Record<string, unknown>) : {};
}

export function slugifyLostReasonId(label: string): string {
  const base = label
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 40);
  return base || "motivo";
}

export function parseManualLostReasons(crmPrefs: unknown): ManualLostReasonItem[] | null {
  const raw = asRecord(crmPrefs).lostReasons;
  if (!Array.isArray(raw) || raw.length === 0) return null;
  const out: ManualLostReasonItem[] = [];
  for (const row of raw) {
    if (!row || typeof row !== "object") continue;
    const o = row as Record<string, unknown>;
    const id = typeof o.id === "string" ? o.id.trim() : "";
    const label = typeof o.label === "string" ? o.label.trim() : "";
    if (!id || !label) continue;
    out.push({ id, label: label.slice(0, MANUAL_LOST_LABEL_MAX) });
  }
  return out.length ? out : null;
}

export function normalizeManualLostReasons(
  input: ManualLostReasonItem[],
): ManualLostReasonItem[] {
  if (!Array.isArray(input) || input.length < MANUAL_LOST_REASONS_MIN) {
    throw new Error(`Informe pelo menos ${MANUAL_LOST_REASONS_MIN} motivo`);
  }
  if (input.length > MANUAL_LOST_REASONS_MAX) {
    throw new Error(`No máximo ${MANUAL_LOST_REASONS_MAX} motivos`);
  }
  const seen = new Set<string>();
  const out: ManualLostReasonItem[] = [];
  for (const row of input) {
    const id = String(row.id ?? "")
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9_]/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 40);
    const label = String(row.label ?? "").trim().slice(0, MANUAL_LOST_LABEL_MAX);
    if (!id || !label) throw new Error("Motivo inválido");
    if (RESERVED_LOST_REASON_IDS.has(id)) {
      throw new Error(`O id "${id}" é reservado para automações`);
    }
    if (seen.has(id)) throw new Error(`Motivo duplicado: ${id}`);
    seen.add(id);
    out.push({ id, label });
  }
  return out;
}

export function uniqueLostReasonId(label: string, existingIds: string[]): string {
  const base = slugifyLostReasonId(label);
  if (!existingIds.includes(base) && !RESERVED_LOST_REASON_IDS.has(base)) return base;
  let i = 2;
  while (i < 100) {
    const candidate = `${base}_${i}`;
    if (!existingIds.includes(candidate) && !RESERVED_LOST_REASON_IDS.has(candidate)) {
      return candidate;
    }
    i++;
  }
  return `${base}_${Date.now().toString(36)}`;
}
