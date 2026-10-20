import { randomBytes } from "crypto";
import { prisma } from "@/lib/db";
import { asShippingRules, quoteStoreCart, type StoreCartLine } from "@/lib/commerce/cart-quote";
import { createMercadoPagoOrder } from "@/lib/commerce/mp";
import { approveOrder } from "@/lib/commerce/orders";
import { isValidCpf, onlyDigits } from "@/lib/commerce/orders";

export type CartItemInput = {
  productId: string;
  variantId?: string | null;
  quantity: number;
};

function publicToken() {
  return randomBytes(24).toString("hex");
}

function formatOptions(options: unknown): Record<string, string> | null {
  if (!options || typeof options !== "object" || Array.isArray(options)) return null;
  const out: Record<string, string> = {};
  for (const [k, v] of Object.entries(options as Record<string, unknown>)) {
    if (typeof v === "string" && v.trim()) out[k] = v.trim();
  }
  return Object.keys(out).length ? out : null;
}

function optionsLabel(options: Record<string, string> | null) {
  if (!options) return "";
  return Object.entries(options)
    .map(([k, v]) => `${k}: ${v}`)
    .join(" · ");
}

export async function resolveCartLines(storeId: string, items: CartItemInput[]): Promise<
  { ok: true; lines: StoreCartLine[] } | { ok: false; error: string }
> {
  if (!items.length) return { ok: false, error: "Carrinho vazio." };
  const lines: StoreCartLine[] = [];

  for (const item of items) {
    if (!item.productId || !Number.isInteger(item.quantity) || item.quantity < 1) {
      return { ok: false, error: "Item inválido." };
    }
    const product = await prisma.commerceProduct.findFirst({
      where: { id: item.productId, storeId, kind: "PHYSICAL", active: true, status: "PUBLISHED" },
      include: { variants: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (!product) return { ok: false, error: "Produto não encontrado." };

    let variant = item.variantId
      ? product.variants.find((v) => v.id === item.variantId)
      : product.variants.length === 1
        ? product.variants[0]
        : null;

    if (product.variants.length > 0 && !variant) {
      return { ok: false, error: `Escolha uma variação de ${product.name}.` };
    }

    const options = variant ? formatOptions(variant.options) : null;
    const priceCents = variant?.priceCents ?? product.priceCents;
    // Estoque só quando há variante; produto sem SKU não bloqueia por qty.
    const stockTracked = Boolean(product.stockTracked && variant);
    const stockQty = stockTracked && variant ? variant.stockQty : null;
    const name = optionsLabel(options) ? `${product.name} (${optionsLabel(options)})` : product.name;

    lines.push({
      productId: product.id,
      variantId: variant?.id ?? null,
      name,
      options,
      priceCents,
      quantity: item.quantity,
      stockQty,
      stockTracked,
      active: product.active && (variant ? variant.active : true),
    });
  }

  return { ok: true, lines };
}

export async function previewStoreOrder(input: {
  storeId: string;
  items: CartItemInput[];
  fulfillment: "SHIP" | "PICKUP";
  cep?: string | null;
  couponCode?: string | null;
}) {
  const store = await prisma.commerceStore.findUnique({ where: { id: input.storeId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada." };

  const resolved = await resolveCartLines(store.id, input.items);
  if (!resolved.ok) return resolved;

  let coupon: { code: string; type: "PERCENT" | "FIXED"; value: number } | null = null;
  if (input.couponCode?.trim()) {
    const row = await prisma.commerceCoupon.findUnique({
      where: {
        clienteId_code: {
          clienteId: store.clienteId,
          code: input.couponCode.trim().toUpperCase(),
        },
      },
    });
    if (!row || !row.active) return { ok: false as const, error: "Cupom inválido." };
    coupon = {
      code: row.code,
      type: row.type === "PERCENT" ? "PERCENT" : "FIXED",
      value: row.value,
    };
  }

  const quote = quoteStoreCart({
    acceptingOrders: store.acceptingOrders && store.published,
    shipEnabled: store.shipEnabled,
    pickupEnabled: store.pickupEnabled,
    minOrderCents: store.minOrderCents,
    shippingRules: asShippingRules(store.shippingRules),
    fulfillment: input.fulfillment,
    cep: input.cep,
    lines: resolved.lines,
    coupon,
  });

  if (!quote.ok) return quote;
  return { ok: true as const, ...quote, lines: resolved.lines };
}

export async function createStoreOrder(input: {
  storeId: string;
  items: CartItemInput[];
  fulfillment: "SHIP" | "PICKUP";
  cep?: string | null;
  couponCode?: string | null;
  expectedTotalCents: number;
  clientRequestId: string;
  email: string;
  name: string;
  phone?: string | null;
  cpf: string;
  shippingAddress?: Record<string, unknown> | null;
  payment: { type: "pix" } | { type: "card"; token: string; paymentMethodId: string; installments: number };
}) {
  const store = await prisma.commerceStore.findUnique({ where: { id: input.storeId } });
  if (!store) return { ok: false as const, error: "Loja não encontrada." };

  if (!input.clientRequestId.trim()) return { ok: false as const, error: "Requisição inválida." };

  const existing = await prisma.commerceOrder.findFirst({
    where: { storeId: store.id, clientRequestId: input.clientRequestId },
    include: { items: true },
  });
  if (existing) {
    return { ok: true as const, order: existing, reused: true as const };
  }

  if (!isValidCpf(input.cpf)) return { ok: false as const, error: "CPF inválido." };
  const email = input.email.trim().toLowerCase();
  if (!email.includes("@")) return { ok: false as const, error: "E-mail inválido." };

  const preview = await previewStoreOrder({
    storeId: store.id,
    items: input.items,
    fulfillment: input.fulfillment,
    cep: input.cep,
    couponCode: input.couponCode,
  });
  if (!preview.ok) return preview;

  if (preview.totalCents !== input.expectedTotalCents) {
    return { ok: false as const, error: "Total desatualizado. Atualize o carrinho." };
  }

  if (input.fulfillment === "SHIP") {
    const addr = input.shippingAddress;
    if (!addr || typeof addr.street !== "string" || !addr.street.trim()) {
      return { ok: false as const, error: "Informe o endereço de entrega." };
    }
  }

  let couponId: string | null = null;
  if (preview.couponCode) {
    const coupon = await prisma.commerceCoupon.findUnique({
      where: { clienteId_code: { clienteId: store.clienteId, code: preview.couponCode } },
    });
    couponId = coupon?.id ?? null;
  }

  const token = publicToken();
  const order = await prisma.$transaction(async (tx) => {
    // reserva estoque
    for (const line of preview.lines) {
      if (!line.stockTracked || !line.variantId) continue;
      const updated = await tx.commerceVariant.updateMany({
        where: { id: line.variantId, stockQty: { gte: line.quantity } },
        data: { stockQty: { decrement: line.quantity } },
      });
      if (!updated.count) throw new Error(`Estoque insuficiente: ${line.name}`);
    }

    return tx.commerceOrder.create({
      data: {
        clienteId: store.clienteId,
        storeId: store.id,
        email,
        name: input.name.trim().slice(0, 200),
        phone: input.phone?.trim().slice(0, 40) || null,
        cpf: onlyDigits(input.cpf),
        status: "PENDING",
        subtotalCents: preview.subtotalCents,
        discountCents: preview.discountCents,
        shippingFeeCents: preview.shippingFeeCents,
        totalCents: preview.totalCents,
        fulfillment: input.fulfillment,
        fulfillmentStatus: "NEW",
        shippingAddress: input.fulfillment === "SHIP" ? (input.shippingAddress ?? undefined) : undefined,
        shippingQuote: preview.shipping,
        publicToken: token,
        clientRequestId: input.clientRequestId,
        couponId,
        productId: preview.lines[0]?.productId ?? null,
        items: {
          create: preview.lines.map((line) => ({
            productId: line.productId,
            variantId: line.variantId,
            name: line.name,
            options: line.options ?? undefined,
            priceCents: line.priceCents,
            quantity: line.quantity,
          })),
        },
      },
      include: { items: true },
    });
  }).catch((err: Error) => {
    return { error: err.message } as const;
  });

  if ("error" in order) return { ok: false as const, error: order.error };

  try {
    const amount = order.totalCents / 100;
    const names = order.name?.trim().split(/\s+/) ?? ["Cliente"];
    const firstName = names[0] || "Cliente";
    const lastName = names.slice(1).join(" ") || firstName;
    const mp = await createMercadoPagoOrder({
      workspaceId: store.clienteId,
      amount,
      description: `Pedido loja ${store.name}`,
      externalReference: order.id,
      payer: {
        email,
        firstName,
        lastName,
        identification: { type: "CPF", number: onlyDigits(input.cpf) },
      },
      payment:
        input.payment.type === "pix"
          ? { type: "bank_transfer", paymentMethodId: "pix" }
          : {
              type: "credit_card",
              token: input.payment.token,
              paymentMethodId: input.payment.paymentMethodId,
              installments: input.payment.installments,
            },
    });

    const pix = mp.transactions?.payments?.[0]?.payment_method;
    const payStatus = mp.transactions?.payments?.[0]?.status;
    const paid =
      mp.status === "processed" ||
      mp.status === "approved" ||
      mp.status === "paid" ||
      payStatus === "approved" ||
      payStatus === "paid";

    const updated = await prisma.commerceOrder.update({
      where: { id: order.id },
      data: {
        mpOrderId: mp.id,
        mpPaymentId: mp.transactions?.payments?.[0]?.id ?? null,
        pixQrCode: pix?.qr_code ?? null,
        pixQrCodeBase64: pix?.qr_code_base64 ?? null,
        pixCopyPaste: pix?.qr_code ?? null,
        status: paid ? "APPROVED" : "PENDING",
        approvedAt: paid ? new Date() : null,
        fulfillmentStatus: paid ? "CONFIRMED" : "NEW",
      },
      include: { items: true },
    });

    if (updated.status === "APPROVED") {
      await approveOrder(updated.id);
    }

    return { ok: true as const, order: updated, reused: false as const, mp };
  } catch (err) {
    // devolve estoque se cobrança falhar
    await prisma.$transaction(async (tx) => {
      for (const line of order.items) {
        if (!line.variantId) continue;
        await tx.commerceVariant.updateMany({
          where: { id: line.variantId },
          data: { stockQty: { increment: line.quantity } },
        });
      }
      await tx.commerceOrder.update({
        where: { id: order.id },
        data: { status: "CANCELLED", fulfillmentStatus: "CANCELLED" },
      });
    });
    return {
      ok: false as const,
      error: err instanceof Error ? err.message : "Falha no pagamento",
    };
  }
}

/** Após pagamento aprovado: confirma fulfillment (estoque já reservado na criação). */
export async function confirmStoreOrderStock(_orderId: string) {
  // estoque já decrementado na criação do pedido; no-op mantido para webhook
}
