/** Histórico de etapas do lead, guardado em `NativeLead.metadata.stageHistory`. */

export type StageHistoryEntry = {
  stageId: string | null;
  stage: string | null;
  role: string | null;
  at: string;
  by: "manual" | "auto";
  reason?: string;
};

export type LostReason = "pedido_nao_pago" | "carrinho_expirado" | "contato_invalido" | "reembolso";

export const LOST_REASON_LABELS: Record<LostReason, string> = {
  pedido_nao_pago: "pedido não pago há 6 meses",
  carrinho_expirado: "sem compra há 6 meses",
  contato_invalido: "e-mail e WhatsApp não chegam",
  reembolso: "reembolso",
};

const MAX_ENTRIES = 40;

export function readStageHistory(meta: unknown): StageHistoryEntry[] {
  if (!meta || typeof meta !== "object" || Array.isArray(meta)) return [];
  const raw = (meta as Record<string, unknown>).stageHistory;
  if (!Array.isArray(raw)) return [];
  return raw.filter(
    (e): e is StageHistoryEntry =>
      !!e && typeof e === "object" && typeof (e as StageHistoryEntry).at === "string",
  );
}

export function withStageHistory(
  meta: Record<string, unknown>,
  entry: Omit<StageHistoryEntry, "at"> & { at?: Date },
): Record<string, unknown> {
  const { at, ...rest } = entry;
  const next: StageHistoryEntry = { ...rest, at: (at ?? new Date()).toISOString() };
  return { ...meta, stageHistory: [...readStageHistory(meta), next].slice(-MAX_ENTRIES) };
}
