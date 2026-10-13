/**
 * Pedido na conversa oficial. Usa o mesmo cardápio e o mesmo createFoodOrder.
 * Não transcreve áudio e não abre outro canal.
 */

import { prisma } from "@/lib/db";
import { asItemSchedule, asWeekHours, isItemOrderable } from "@/lib/food/availability";
import { createFoodOrder, previewFoodOrder } from "@/lib/food/orders";
import { foodCodeIsPending } from "@/lib/food/customer";
import { toPhoneE164 } from "@/lib/atrako/person";
import type { FoodPaymentMethod } from "@/lib/food/quote";
import { Prisma } from "@/lib/generated/prisma";
import { sendAndPersistText } from "@/lib/whatsapp/domain";

type CartLine = { itemId: string; quantity: number };
type Cart = {
  step: "ITEMS" | "FULFILLMENT" | "ADDRESS" | "PAYMENT";
  lines: CartLine[];
  fulfillment?: "DELIVERY" | "PICKUP";
  address?: string;
  lat?: number;
  lng?: number;
  quotedTotalCents?: number;
};

function asCart(value: unknown): Cart {
  if (!value || typeof value !== "object" || Array.isArray(value)) return { step: "ITEMS", lines: [] };
  const raw = value as Partial<Cart>;
  return {
    step: raw.step === "FULFILLMENT" || raw.step === "ADDRESS" || raw.step === "PAYMENT" ? raw.step : "ITEMS",
    lines: Array.isArray(raw.lines)
      ? raw.lines
          .filter((line) => line && typeof line.itemId === "string" && Number(line.quantity) > 0)
          .map((line) => ({ itemId: String(line.itemId), quantity: Math.min(30, Number(line.quantity)) }))
      : [],
    fulfillment: raw.fulfillment === "DELIVERY" || raw.fulfillment === "PICKUP" ? raw.fulfillment : undefined,
    address: typeof raw.address === "string" ? raw.address : undefined,
    lat: Number.isFinite(Number(raw.lat)) ? Number(raw.lat) : undefined,
    lng: Number.isFinite(Number(raw.lng)) ? Number(raw.lng) : undefined,
    quotedTotalCents: Number.isInteger(raw.quotedTotalCents) ? Number(raw.quotedTotalCents) : undefined,
  };
}

function money(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export async function handleFoodWhatsAppMessage(input: {
  workspaceId: string;
  conversationId: string;
  phone: string;
  contactName: string | null;
  body: string | null;
  location?: { lat: number; lng: number } | null;
}): Promise<boolean> {
  const text = (input.body ?? "").trim();
  const phoneE164 = toPhoneE164(input.phone);
  if (phoneE164 && /^\d{6}$/.test(text)) {
    const contact = await prisma.nativeContact.findFirst({
      where: { clienteId: input.workspaceId, phoneE164 },
      select: { metadata: true },
    });
    if (foodCodeIsPending(contact?.metadata, text)) {
      await sendAndPersistText({
        workspaceId: input.workspaceId,
        to: input.phone,
        body: "Digite esse código no cardápio para confirmar o celular.",
      });
      return true;
    }
  }
  if ((!text || text.startsWith("[")) && !input.location) return false;

  const store = await prisma.foodStore.findUnique({
    where: { clienteId: input.workspaceId },
    include: {
      categories: true,
      items: { orderBy: { sortOrder: "asc" }, include: { category: true, groups: true } },
    },
  });
  if (!store || store.status === "DISABLED") return false;

  const hours = asWeekHours(store.hours);
  const sellable = store.items.filter(
    (item) =>
      item.groups.every((group) => group.minSelect === 0) &&
      isItemOrderable({
        available: item.available,
        categoryActive: item.category.active,
        storeHours: hours,
        schedule: asItemSchedule(item.schedule),
      }),
  );
  const conversation = await prisma.waConversation.findUnique({
    where: { id: input.conversationId },
    select: { foodCart: true },
  });
  let cart = asCart(conversation?.foodCart);
  const lower = text.toLowerCase();

  const reply = async (body: string, next: Cart) => {
    await prisma.waConversation.update({
      where: { id: input.conversationId },
      data: { foodCart: next as Prisma.InputJsonValue },
    });
    await sendAndPersistText({
      workspaceId: input.workspaceId,
      to: input.phone,
      body,
      contactId: undefined,
    });
  };

  if (lower === "cancelar") {
    await reply("Pedido cancelado. Quando quiser, peça o cardápio.", { step: "ITEMS", lines: [] });
    return true;
  }

  if (cart.step === "ITEMS" && (lower === "cardapio" || lower === "cardápio" || lower === "menu" || !cart.lines.length && /^(oi|ol[aá]|bom dia|boa tarde|boa noite)$/.test(lower))) {
    const list = sellable.map((item, index) => `${index + 1}. ${item.name} — ${money(item.priceCents)}`).join("\n");
    await reply(
      list
        ? `Cardápio ${store.name}:\n${list}\n\nResponda com o número e a quantidade. Exemplo: 1 2\nQuando terminar, escreva fechar.\nItens com complemento obrigatório ficam em ${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ""}/cardapio/${store.slug}`
        : "No momento não há itens disponíveis.",
      { step: "ITEMS", lines: [] },
    );
    return true;
  }

  if (cart.step === "ITEMS") {
    if (lower === "fechar") {
      if (!cart.lines.length) {
        await reply("Seu pedido ainda está vazio. Envie o número do item e a quantidade.", cart);
        return true;
      }
      await reply("Entrega ou retirada?", { ...cart, step: "FULFILLMENT" });
      return true;
    }
    const match = /^(\d+)\s+(\d+)$/.exec(text);
    const item = match ? sellable[Number(match[1]) - 1] : null;
    if (!item) {
      await reply("Não encontrei esse item. Peça o cardápio ou envie número e quantidade, como 1 2.", cart);
      return true;
    }
    const quantity = Math.min(30, Number(match?.[2]));
    const lines = [...cart.lines];
    const current = lines.find((line) => line.itemId === item.id);
    if (current) current.quantity += quantity;
    else lines.push({ itemId: item.id, quantity });
    await reply(`${quantity}× ${item.name} entrou. Envie outro item ou escreva fechar.`, { step: "ITEMS", lines });
    return true;
  }

  if (cart.step === "FULFILLMENT") {
    const fulfillment = /retir/.test(lower) ? "PICKUP" : /entreg/.test(lower) ? "DELIVERY" : null;
    if (!fulfillment) {
      await reply("Responda entrega ou retirada.", cart);
      return true;
    }
    if (fulfillment === "PICKUP") {
      await reply("Como vai pagar: pix, dinheiro ou cartão?", { ...cart, step: "PAYMENT", fulfillment });
      return true;
    }
    await reply("Envie o endereço: rua, número, bairro e CEP.", { ...cart, step: "ADDRESS", fulfillment });
    return true;
  }

  if (cart.step === "ADDRESS") {
    if (input.location) {
      const next = { ...cart, lat: input.location.lat, lng: input.location.lng };
      if (!next.address) {
        await reply("Pin recebido. Agora envie rua, número, bairro e CEP, separados por vírgula.", next);
        return true;
      }
      const quoted = await quoteCart(store.slug, input, next);
      if (!quoted.ok) {
        await reply(quoted.error, next);
        return true;
      }
      const km = quoted.distanceKm != null ? `${quoted.distanceKm.toLocaleString("pt-BR")} km em linha reta. ` : "";
      await reply(`${km}Frete ${money(quoted.deliveryFeeCents)}. Total ${money(quoted.totalCents)}. Como vai pagar: pix, dinheiro ou cartão?`, {
        ...next,
        step: "PAYMENT",
        quotedTotalCents: quoted.totalCents,
      });
      return true;
    }
    const parts = text.split(",").map((part) => part.trim());
    if (parts.length < 4) {
      await reply("Separe rua, número, bairro e CEP por vírgula.", cart);
      return true;
    }
    const next = { ...cart, address: text };
    const quoted = await quoteCart(store.slug, input, next);
    if (!quoted.ok) {
      const link = `${process.env.NEXT_PUBLIC_APP_URL || process.env.NEXT_PUBLIC_BASE_URL || ""}/cardapio/${store.slug}`;
      const message = quoted.error === "Compartilhe a localização para calcular o frete."
        ? `Para calcular o frete, envie o pin de localização nesta conversa. Se preferir, peça pelo cardápio: ${link}`
        : quoted.error;
      await reply(message, next);
      return true;
    }
    const km = quoted.distanceKm != null ? `${quoted.distanceKm.toLocaleString("pt-BR")} km em linha reta. ` : "";
    await reply(`${km}Frete ${money(quoted.deliveryFeeCents)}. Total ${money(quoted.totalCents)}. Como vai pagar: pix, dinheiro ou cartão?`, {
      ...next,
      step: "PAYMENT",
      quotedTotalCents: quoted.totalCents,
    });
    return true;
  }

  const payment: FoodPaymentMethod | null = /pix/.test(lower)
    ? "PIX"
    : /dinheiro/.test(lower)
      ? "CASH"
      : /cart[aã]o/.test(lower)
        ? "CARD_ON_DELIVERY"
        : null;
  if (!payment || !cart.fulfillment) {
    await reply("Responda pix, dinheiro ou cartão.", cart);
    return true;
  }
  const addressParts = (cart.address ?? "").split(",").map((part) => part.trim());
  const created = await createFoodOrder({
    slug: store.slug,
    clientRequestId: `wa-${input.conversationId}-${Date.now()}`,
    channel: "WHATSAPP",
    fulfillment: cart.fulfillment,
    paymentMethod: payment,
    customerName: input.contactName?.trim() || "Cliente WhatsApp",
    phone: input.phone,
    expectedTotalCents: cart.fulfillment === "DELIVERY" ? cart.quotedTotalCents ?? null : null,
    address: cart.fulfillment === "DELIVERY"
      ? {
          street: addressParts[0],
          number: addressParts[1],
          neighborhood: addressParts[2],
          cep: addressParts[3],
          lat: cart.lat ?? null,
          lng: cart.lng ?? null,
        }
      : null,
    items: cart.lines,
  });
  if (!created.ok) {
    const next = "totalCents" in created && typeof created.totalCents === "number"
      ? { ...cart, quotedTotalCents: created.totalCents }
      : cart;
    await reply(created.error, next);
    return true;
  }
  const pix = created.order.pixCopyPaste ? `\nPix: ${created.order.pixCopyPaste}` : "";
  await reply(`Pedido #${created.order.number} registrado. Total ${created.order.totalLabel}.${pix}`, { step: "ITEMS", lines: [] });
  return true;
}

async function quoteCart(
  slug: string,
  input: { phone: string; contactName: string | null },
  cart: Cart,
) {
  const parts = (cart.address ?? "").split(",").map((part) => part.trim());
  return previewFoodOrder({
    slug,
    clientRequestId: `wa-quote-${Date.now()}`,
    channel: "WHATSAPP",
    fulfillment: "DELIVERY",
    paymentMethod: "PIX",
    customerName: input.contactName?.trim() || "Cliente WhatsApp",
    phone: input.phone,
    address: {
      street: parts[0],
      number: parts[1],
      neighborhood: parts[2],
      cep: parts[3],
      lat: cart.lat ?? null,
      lng: cart.lng ?? null,
    },
    items: cart.lines,
  });
}
