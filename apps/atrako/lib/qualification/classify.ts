/**
 * Score A/B/C determinístico — preset franchise_regicenter.
 */

export type InvestmentStatus = "available" | "partial" | "evaluating";
export type Timeline = "within_30_days" | "within_60_90_days" | "later";
export type Objective = "owner_operator" | "additional_income" | "build_team" | "exploring";
export type Priority = "A" | "B" | "C";

export type QualifySnapshot = {
  investmentStatus?: InvestmentStatus | null;
  timeline?: Timeline | null;
  objective?: Objective | null;
  nicheCode?: string | null;
  city?: string | null;
};

const ICP_NICHES = new Set([
  "NICHE_LAW",
  "NICHE_ACCOUNTING",
  "NICHE_MARKETING",
  "NICHE_INSURANCE",
  "NICHE_SAAS",
]);

export function mapInvestmentCode(code: string | undefined): InvestmentStatus | null {
  if (code === "CAPITAL_AVAILABLE" || code === "available") return "available";
  if (code === "CAPITAL_PARTIAL" || code === "partial") return "partial";
  if (code === "CAPITAL_EVALUATING" || code === "evaluating") return "evaluating";
  return null;
}

export function mapTimelineCode(code: string | undefined): Timeline | null {
  if (code === "START_30D" || code === "within_30_days") return "within_30_days";
  if (code === "START_60_90D" || code === "within_60_90_days") return "within_60_90_days";
  if (code === "START_LATER" || code === "later") return "later";
  return null;
}

export function mapObjectiveCode(code: string | undefined): Objective | null {
  if (code === "OWNER_OPERATOR" || code === "owner_operator") return "owner_operator";
  if (code === "ADDITIONAL_INCOME" || code === "additional_income") return "additional_income";
  if (code === "BUILD_TEAM" || code === "build_team") return "build_team";
  if (code === "EXPLORING" || code === "exploring") return "exploring";
  return null;
}

export function classifyLead(q: QualifySnapshot): Priority {
  const investment = q.investmentStatus;
  const timeline = q.timeline;
  const objective = q.objective;
  if (!investment || !timeline) return "C";

  if (
    investment === "partial" ||
    investment === "evaluating" ||
    timeline === "later" ||
    objective === "exploring"
  ) {
    return "C";
  }

  const nicheOk = !q.nicheCode || ICP_NICHES.has(q.nicheCode) || q.nicheCode === "NICHE_OTHER";
  const cityOk = Boolean(q.city?.trim());
  const wouldBeA = investment === "available" && timeline === "within_30_days";

  if (wouldBeA) {
    if (q.nicheCode === "NICHE_OTHER" && !cityOk) return "B";
    if (!nicheOk && !cityOk) return "B";
    return "A";
  }

  return "B";
}
