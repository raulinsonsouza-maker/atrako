import { platformMercadoPagoConfigured } from "@/lib/billing/platform";

const MP_API = "https://api.mercadopago.com";

export async function pingPlatformMercadoPago() {
  const token = process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) return { ok: false, error: "Token não configurado" };

  try {
    const res = await fetch(`${MP_API}/users/me`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) {
      const body = await res.text();
      return { ok: false, error: body.slice(0, 200) || res.statusText };
    }
    const data = (await res.json()) as { id?: number; nickname?: string };
    return { ok: true, userId: data.id, nickname: data.nickname };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : "Erro de rede" };
  }
}

export async function createPlatformPreapproval(params: {
  reason: string;
  payerEmail: string;
  amountCents: number;
  backUrl: string;
  externalReference: string;
}) {
  const token = process.env.PLATFORM_MERCADOPAGO_ACCESS_TOKEN?.trim();
  if (!token) throw new Error("PLATFORM_MERCADOPAGO_ACCESS_TOKEN ausente");

  const res = await fetch(`${MP_API}/preapproval`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      reason: params.reason,
      payer_email: params.payerEmail,
      auto_recurring: {
        frequency: 1,
        frequency_type: "months",
        transaction_amount: params.amountCents / 100,
        currency_id: "BRL",
      },
      back_url: params.backUrl,
      external_reference: params.externalReference,
      status: "pending",
    }),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(
      typeof data.message === "string" ? data.message : "Erro ao criar assinatura MP",
    );
  }

  return data as {
    id: string;
    init_point?: string;
    status?: string;
  };
}

export function platformMpPublicKey() {
  return process.env.PLATFORM_MERCADOPAGO_PUBLIC_KEY?.trim() || null;
}

export function platformBillingReady() {
  return platformMercadoPagoConfigured();
}
