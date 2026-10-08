export type ScoreInput = {
  published: boolean;
  issueCount: number;
  edits: number;
  /** Leads ou pedidos sobre visitas. Null quando não há visita medida. */
  conversionRate: number | null;
  uses: number;
  approved: boolean;
};

/** Nota usada na ordenação. Curadoria pesa mais que volume cru de uso. */
export function sectionScore(input: ScoreInput): number {
  let score = 0;
  if (input.published) score += 2;
  if (input.issueCount === 0) score += 2;
  score += Math.max(0, 2 - input.edits * 0.5);
  if (input.conversionRate != null && input.conversionRate > 0) {
    score += Math.min(4, input.conversionRate * 20);
  }
  score += Math.min(3, Math.log2(input.uses + 1));
  if (input.approved) score += 3;
  return Math.round(score * 100) / 100;
}
