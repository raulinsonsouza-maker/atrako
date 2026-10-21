import { NextRequest, NextResponse } from "next/server";
import { chargePaymentLink, type PaymentLinkCharge } from "@/lib/crm/payment-links";

type Ctx = { params: Promise<{ token: string }> };

const WINDOW_MS = 10 * 60_000;
const MAX_ATTEMPTS = 8;
const attempts = new Map<string, number[]>();

function throttled(key: string) {
  const now = Date.now();
  const recent = (attempts.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  recent.push(now);
  attempts.set(key, recent);
  return recent.length > MAX_ATTEMPTS;
}

const s = (v: unknown) => (typeof v === "string" ? v : "");

export async function POST(request: NextRequest, ctx: Ctx) {
  const { token } = await ctx.params;
  const ip = (request.headers.get("x-forwarded-for") ?? "").split(",")[0].trim() || "local";
  if (throttled(`${token}:${ip}`)) {
    return NextResponse.json({ error: "Muitas tentativas. Aguarde alguns minutos." }, { status: 429 });
  }
  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  if (!body) return NextResponse.json({ error: "Dados inválidos." }, { status: 400 });

  const base = { name: s(body.name), email: s(body.email), cpf: s(body.cpf) };
  const payment: PaymentLinkCharge =
    body.method === "card"
      ? {
          ...base,
          method: "card",
          token: s(body.cardToken),
          paymentMethodId: s(body.paymentMethodId),
          installments: Number(body.installments),
        }
      : { ...base, method: "pix" };

  const result = await chargePaymentLink(token, payment);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: result.status ?? 400 });
  return NextResponse.json(result);
}
