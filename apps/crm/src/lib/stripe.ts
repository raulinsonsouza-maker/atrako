import Stripe from "stripe";

export const stripe =
  process.env.STRIPE_SECRET_KEY ?
    new Stripe(process.env.STRIPE_SECRET_KEY, { apiVersion: "2025-02-24.acacia" })
  : null;

const PRICE_TO_PLAN: Record<string, "STARTER" | "PRO" | "ENTERPRISE"> = {
  [process.env.STRIPE_PRICE_STARTER ?? ""]: "STARTER",
  [process.env.STRIPE_PRICE_PRO ?? ""]: "PRO",
  [process.env.STRIPE_PRICE_ENTERPRISE ?? ""]: "ENTERPRISE",
};

export function priceToPlan(priceId: string): "STARTER" | "PRO" | "ENTERPRISE" {
  return PRICE_TO_PLAN[priceId] ?? "STARTER";
}
