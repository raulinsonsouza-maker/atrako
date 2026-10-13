/**
 * Commerce — Mercado Pago do workspace via Config (WorkspaceConnection).
 * Nunca gravar token local; usar resolveMercadoPago / mpFetch.
 */

import { randomUUID } from "crypto";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";
import { mpFetch } from "@/lib/integrations/mercadopago/payments";

export type CreateMpOrderInput = {
  workspaceId: string;
  externalReference: string;
  amount: number;
  description: string;
  payer: {
    email: string;
    firstName?: string;
    lastName?: string;
    identification?: { type: string; number: string };
  };
  payment:
    | {
        type: "credit_card" | "debit_card";
        token: string;
        installments: number;
        paymentMethodId: string;
      }
    | { type: "bank_transfer"; paymentMethodId: "pix" };
  statementDescriptor?: string;
};

export async function createMercadoPagoOrder(input: CreateMpOrderInput) {
  const creds = await resolveMercadoPago(input.workspaceId);
  if (!creds) throw new Error("Mercado Pago não conectado neste workspace (Config → Conexões)");

  const paymentMethod =
    input.payment.type === "bank_transfer"
      ? { id: "pix", type: "bank_transfer" }
      : {
          id: input.payment.paymentMethodId,
          type: input.payment.type,
          token: input.payment.token,
          installments: input.payment.installments,
          statement_descriptor: input.statementDescriptor ?? "ATRAKO",
        };

  const body = {
    type: "online",
    external_reference: input.externalReference,
    processing_mode: "automatic",
    total_amount: input.amount.toFixed(2),
    description: input.description,
    payer: {
      email: input.payer.email,
      first_name: input.payer.firstName,
      last_name: input.payer.lastName,
      identification: input.payer.identification,
    },
    transactions: {
      payments: [{ amount: input.amount.toFixed(2), payment_method: paymentMethod }],
    },
  };

  const res = await mpFetch(input.workspaceId, "/v1/orders", {
    method: "POST",
    headers: { "X-Idempotency-Key": randomUUID() },
    body: JSON.stringify(body),
  });
  const data = (await res.json()) as Record<string, unknown>;
  if (!res.ok) {
    throw new Error(String(data?.message || data?.error || "Falha ao criar pedido MP"));
  }
  return data as {
    id: string;
    status: string;
    transactions?: {
      payments?: Array<{
        id?: string;
        status?: string;
        payment_method?: {
          qr_code?: string;
          qr_code_base64?: string;
        };
      }>;
    };
  };
}

export async function getMercadoPagoPayment(workspaceId: string, paymentId: string) {
  const res = await mpFetch(workspaceId, `/v1/payments/${paymentId}`);
  const data = (await res.json()) as {
    status?: string;
    external_reference?: string;
    transaction_amount?: number;
  };
  if (!res.ok) throw new Error("Falha ao buscar pagamento MP");
  return {
    status: String(data.status ?? ""),
    externalReference: String(data.external_reference ?? ""),
    amount: Number(data.transaction_amount ?? 0),
  };
}

export async function listMpInstallments(workspaceId: string, bin: string, amount: number) {
  const creds = await resolveMercadoPago(workspaceId);
  if (!creds?.publicKey) throw new Error("Mercado Pago sem chave pública neste workspace");
  const url = new URL("https://api.mercadopago.com/v1/payment_methods/installments");
  url.searchParams.set("public_key", creds.publicKey);
  url.searchParams.set("bin", bin);
  url.searchParams.set("amount", amount.toFixed(2));
  const res = await fetch(url);
  const data = (await res.json()) as Array<{
    payment_method_id?: string;
    payer_costs?: Array<{
      installments?: number;
      installment_amount?: number;
      total_amount?: number;
      recommended_message?: string;
    }>;
  }>;
  if (!res.ok || !Array.isArray(data) || !data[0]) {
    throw new Error("Não foi possível consultar as parcelas.");
  }
  const row = data[0];
  return {
    paymentMethodId: String(row.payment_method_id || ""),
    options: (row.payer_costs ?? [])
      .filter((item) => Number(item.installments) >= 1)
      .map((item) => ({
        installments: Number(item.installments),
        installmentAmountCents: Math.round(Number(item.installment_amount || 0) * 100),
        totalAmountCents: Math.round(Number(item.total_amount || 0) * 100),
        label: item.recommended_message || `${item.installments}x`,
      })),
  };
}

export async function getMercadoPagoOrder(workspaceId: string, mpOrderId: string) {
  const res = await mpFetch(workspaceId, `/v1/orders/${mpOrderId}`);
  const data = await res.json();
  if (!res.ok) throw new Error("Falha ao buscar pedido MP");
  return data as { id?: string; status?: string };
}
