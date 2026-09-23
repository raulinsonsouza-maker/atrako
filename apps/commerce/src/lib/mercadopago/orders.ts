import { getSellerAccessToken } from "@/lib/mercadopago/client";
import { randomUUID } from "crypto";

type CreateOrderInput = {
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
    | {
        type: "bank_transfer";
        paymentMethodId: "pix";
      };
  statementDescriptor?: string;
};

export async function createMercadoPagoOrder(input: CreateOrderInput) {
  const accessToken = await getSellerAccessToken();
  if (!accessToken) throw new Error("Mercado Pago account not connected");

  const paymentMethod =
    input.payment.type === "bank_transfer"
      ? {
          id: "pix",
          type: "bank_transfer",
        }
      : {
          id: input.payment.paymentMethodId,
          type: input.payment.type,
          token: input.payment.token,
          installments: input.payment.installments,
          statement_descriptor: input.statementDescriptor ?? "LOJA",
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
      payments: [
        {
          amount: input.amount.toFixed(2),
          payment_method: paymentMethod,
        },
      ],
    },
  };

  const res = await fetch("https://api.mercadopago.com/v1/orders", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify(body),
  });

  const data = await res.json();
  if (!res.ok) {
    throw new Error(data?.message || data?.error || "Failed to create MP order");
  }
  return data as {
    id: string;
    status: string;
    transactions?: {
      payments?: Array<{
        id?: string;
        status?: string;
        payment_method?: {
          id?: string;
          type?: string;
          qr_code?: string;
          qr_code_base64?: string;
          ticket_url?: string;
        };
      }>;
    };
  };
}

export async function getMercadoPagoOrder(mpOrderId: string) {
  const accessToken = await getSellerAccessToken();
  if (!accessToken) throw new Error("Mercado Pago account not connected");
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${mpOrderId}`, {
    headers: { Authorization: `Bearer ${accessToken}` },
  });
  const data = await res.json();
  if (!res.ok) throw new Error("Failed to fetch MP order");
  return data;
}

export async function refundMercadoPagoOrder(mpOrderId: string) {
  const accessToken = await getSellerAccessToken();
  if (!accessToken) throw new Error("Mercado Pago account not connected");
  const res = await fetch(`https://api.mercadopago.com/v1/orders/${mpOrderId}/refund`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
      "X-Idempotency-Key": randomUUID(),
    },
    body: JSON.stringify({}),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(data?.message || "Refund failed");
  return data;
}
