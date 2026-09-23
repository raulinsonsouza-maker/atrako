export type AccountHealthStatus = "RED" | "YELLOW" | "GREEN" | "GRAY";

type AccountHealthInput = {
  now: Date;
  hasMetaAccount: boolean;
  hasGoogleAccount: boolean;
  latestMetaDataAt: Date | null;
  latestGoogleDataAt: Date | null;
  metaPaymentMethod: string | null;
  metaBalance: number | null;
  metaBalanceUpdatedAt: Date | null;
  monthlyBudgetMeta: number | null;
  monthlyBudgetGoogle: number | null;
  monthlySpendMeta: number;
  monthlySpendGoogle: number;
  last7SpendMeta: number;
  completeMonthSpend: number;
  completeMonthDataDays: number;
};

const MAX_DATA_AGE_MS = 48 * 60 * 60 * 1000;
const PREPAID_METHODS = new Set(["pix", "boleto"]);

function isFresh(value: Date | null, now: Date) {
  return value != null && now.getTime() - value.getTime() <= MAX_DATA_AGE_MS;
}

export function evaluateAccountHealthStatus(input: AccountHealthInput): AccountHealthStatus {
  const hasPaidMediaAccount = input.hasMetaAccount || input.hasGoogleAccount;
  if (!hasPaidMediaAccount) return "GRAY";

  let hasUnavailableCoverage = false;
  let hasYellowRisk = false;
  let hasRedRisk = false;

  if (input.hasMetaAccount && !isFresh(input.latestMetaDataAt, input.now)) {
    hasUnavailableCoverage = true;
  }
  if (input.hasGoogleAccount && !isFresh(input.latestGoogleDataAt, input.now)) {
    hasUnavailableCoverage = true;
  }

  const isMetaPrepaid =
    input.hasMetaAccount &&
    PREPAID_METHODS.has((input.metaPaymentMethod ?? "").trim().toLocaleLowerCase("pt-BR"));

  if (isMetaPrepaid) {
    if (!isFresh(input.metaBalanceUpdatedAt, input.now) || input.metaBalance == null) {
      hasUnavailableCoverage = true;
    } else if (input.metaBalance <= 0) {
      hasRedRisk = true;
    } else {
      const dailyBurn = input.last7SpendMeta / 7;
      if (dailyBurn > 0 && input.metaBalance / dailyBurn <= 3) hasYellowRisk = true;
    }
  }

  const budgetTotal = (input.monthlyBudgetMeta ?? 0) + (input.monthlyBudgetGoogle ?? 0);
  const spendTotal = input.monthlySpendMeta + input.monthlySpendGoogle;

  if (budgetTotal <= 0) {
    hasUnavailableCoverage = true;
  } else {
    if (spendTotal > budgetTotal) hasRedRisk = true;

    const completeDaysElapsed = input.now.getDate() - 1;
    const daysInMonth = new Date(input.now.getFullYear(), input.now.getMonth() + 1, 0).getDate();
    if (completeDaysElapsed >= 3 && input.completeMonthDataDays >= 3) {
      const projectedSpend = (input.completeMonthSpend / completeDaysElapsed) * daysInMonth;
      if (projectedSpend > budgetTotal) hasYellowRisk = true;
    }
  }

  if (hasRedRisk) return "RED";
  if (hasYellowRisk) return "YELLOW";
  if (hasUnavailableCoverage) return "GRAY";
  return "GREEN";
}