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

export async function getMercadoPagoOrder(workspaceId: string, mpOrderId: string) {
  const res = await mpFetch(workspaceId, `/v1/orders/${mpOrderId}`);
  const data = await res.json();
  if (!res.ok) throw new Error("Falha ao buscar pedido MP");
  return data as { id?: string; status?: string };
}
