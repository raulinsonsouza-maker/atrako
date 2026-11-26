import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import { onlyDigits } from "@/lib/commerce/orders";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { Prisma } from "@/lib/generated/prisma";

type ShippingBody = {
  street?: unknown;
  number?: unknown;
  complement?: unknown;
  neighborhood?: unknown;
  city?: unknown;
  state?: unknown;
  cep?: unknown;
};

function parseShipping(raw: unknown): Prisma.InputJsonValue | undefined {
  if (!raw || typeof raw !== "object" || Array.isArray(raw)) return undefined;
  const a = raw as ShippingBody;
  const street = String(a.street ?? "").trim().slice(0, 200);
  const number = String(a.number ?? "").trim().slice(0, 40);
  const city = String(a.city ?? "").trim().slice(0, 120);
  const state = String(a.state ?? "").trim().toUpperCase().slice(0, 2);
  const cep = onlyDigits(String(a.cep ?? "")).slice(0, 8);
  if (!street || !number || !city || state.length !== 2 || cep.length !== 8) return undefined;
  return {
    street,
    number,
    complement: String(a.complement ?? "").trim().slice(0, 120) || undefined,
    neighborhood: String(a.neighborhood ?? "").trim().slice(0, 120) || undefined,
    city,
    state,
    cep,
  } as Prisma.InputJsonValue;
}

/**
 * Persiste progresso mid-checkout: step 1 cria lead + pedido DRAFT;
 * step 2 atualiza endereço. Idempotente via clientRequestId.
 */
export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    if (typeof body.previewToken === "string" && body.previewToken.trim()) {
      return NextResponse.json({ skipped: true, preview: true });
    }

    const productId =
      (typeof body.productId === "string" && body.productId.trim()) ||
      (typeof body.pageProductId === "string" && body.pageProductId.trim()) ||
      "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const phone = typeof body.phone === "string" ? body.phone : "";
    const cpf = typeof body.cpf === "string" ? body.cpf : "";
    const step = typeof body.step === "number" ? body.step : Number(body.step);
    const clientRequestId =
      typeof body.clientRequestId === "string" && body.clientRequestId.trim()
        ? body.clientRequestId.trim().slice(0, 80)
        : randomUUID().slice(0, 80);
    const pageSlug =
      typeof body.pageSlug === "string" && body.pageSlug.trim()
        ? body.pageSlug.trim()
        : undefined;
    const variantId = typeof body.variantId === "string" ? body.variantId : "";

    if (!productId || !email || !name || (step !== 1 && step !== 2)) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }
    if (!/^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email)) {
      return NextResponse.json({ error: "E-mail inválido" }, { status: 400 });
    }
    if (onlyDigits(phone).length < 10) {
      return NextResponse.json({ error: "WhatsApp inválido" }, { status: 400 });
    }

    const product = await prisma.commerceProduct.findUnique({
      where: { id: productId },
      include: { variants: { where: { active: true }, orderBy: { sortOrder: "asc" } } },
    });
    if (
      !product ||
      !product.active ||
      product.status !== "PUBLISHED" ||
      !(await isPublicModuleEnabled(product.clienteId, "commerce"))
    ) {
      return NextResponse.json({ error: "Produto indisponível" }, { status: 404 });
    }

    const variant =
      variantId && product.variants.length
        ? product.variants.find((v) => v.id === variantId) ?? null
        : product.variants[0] ?? null;

    let itemName = product.name;
    let priceCents = variant?.priceCents ?? product.priceCents;
    if (variant) {
      const opts =
        variant.options && typeof variant.options === "object" && !Array.isArray(variant.options)
          ? (variant.options as Record<string, string>)
          : {};
      const label = Object.values(opts).filter(Boolean).join(" · ");
      if (label) itemName = `${product.name} — ${label}`;
    }

    const attrRaw = (body.attribution as Record<string, string> | undefined) ?? {};
    const leadSource = pageSlug ? `lp:${pageSlug}` : `checkout:${product.slug}`;

    const { contact, lead } = await upsertPersonAndLead({
      workspaceId: product.clienteId,
      name,
      email,
      phone: phone || undefined,
      source: leadSource,
      metadata: {
        channel: "checkout",
        lastTouchChannel: "checkout",
        utmSource: attrRaw.utmSource || attrRaw.utm_source,
        utmMedium: attrRaw.utmMedium || attrRaw.utm_medium,
        utmCampaign: attrRaw.utmCampaign || attrRaw.utm_campaign,
        utmContent: attrRaw.utmContent || attrRaw.utm_content,
        utmTerm: attrRaw.utmTerm || attrRaw.utm_term,
        productId: product.id,
        productSlug: product.slug,
        productName: product.name,
        priceCents: product.priceCents,
        pageSlug,
        pageProductId: productId,
        pageUrl: attrRaw.pageUrl,
        checkoutProductId: product.id,
        referrer: attrRaw.referrer,
        gclid: attrRaw.gclid,
        fbclid: attrRaw.fbclid,
        checkoutDraft: true,
        checkoutStep: step,
      },
    });

    const shippingAddress = step >= 2 ? parseShipping(body.shippingAddress) : undefined;
    const draftMeta = {
      draft: true,
      pageSlug: pageSlug ?? null,
      step,
    } as Prisma.InputJsonValue;

    const existing = await prisma.commerceOrder.findFirst({
      where: {
        clienteId: product.clienteId,
        clientRequestId,
        status: { in: ["DRAFT", "PENDING"] },
        mpOrderId: null,
      },
      include: { items: true },
      orderBy: { createdAt: "desc" },
    });

    let orderId: string;

    if (existing) {
      await prisma.commerceOrder.update({
        where: { id: existing.id },
        data: {
          status: "DRAFT",
          contactId: contact.id,
          email,
          name,
          cpf: cpf ? onlyDigits(cpf).slice(0, 20) : existing.cpf,
          phone: phone ? onlyDigits(phone) : existing.phone,
          productId: product.id,
          storeId: product.storeId ?? undefined,
          subtotalCents: priceCents,
          totalCents: priceCents,
          fulfillment: shippingAddress || product.kind === "PHYSICAL" ? "SHIP" : "DIGITAL",
          shippingAddress: shippingAddress ?? undefined,
          shippingQuote: draftMeta,
          utmSource: attrRaw.utmSource || attrRaw.utm_source || existing.utmSource,
          utmMedium: attrRaw.utmMedium || attrRaw.utm_medium || existing.utmMedium,
          utmCampaign: attrRaw.utmCampaign || attrRaw.utm_campaign || existing.utmCampaign,
          utmContent: attrRaw.utmContent || attrRaw.utm_content || existing.utmContent,
          utmTerm: attrRaw.utmTerm || attrRaw.utm_term || existing.utmTerm,
          fbclid: attrRaw.fbclid || existing.fbclid,
        },
      });

      if (existing.items[0]) {
        await prisma.commerceOrderItem.update({
          where: { id: existing.items[0].id },
          data: {
            productId: product.id,
            variantId: variant?.id,
            name: itemName,
            priceCents,
            options:
              variant?.options && typeof variant.options === "object" && !Array.isArray(variant.options)
                ? (variant.options as Prisma.InputJsonValue)
                : undefined,
          },
        });
      } else {
        await prisma.commerceOrderItem.create({
          data: {
            orderId: existing.id,
            productId: product.id,
            variantId: variant?.id,
            name: itemName,
            priceCents,
            options:
              variant?.options && typeof variant.options === "object" && !Array.isArray(variant.options)
                ? (variant.options as Prisma.InputJsonValue)
                : undefined,
          },
        });
      }
      orderId = existing.id;
    } else {
      const created = await prisma.commerceOrder.create({
        data: {
          clienteId: product.clienteId,
          storeId: product.storeId ?? undefined,
          productId: product.id,
          contactId: contact.id,
          email,
          name,
          cpf: cpf ? onlyDigits(cpf).slice(0, 20) : null,
          phone: phone ? onlyDigits(phone) : null,
          status: "DRAFT",
          subtotalCents: priceCents,
          discountCents: 0,
          shippingFeeCents: 0,
          totalCents: priceCents,
          fulfillment: shippingAddress || product.kind === "PHYSICAL" ? "SHIP" : "DIGITAL",
          fulfillmentStatus: "NEW",
          shippingAddress: shippingAddress ?? undefined,
          shippingQuote: draftMeta,
          clientRequestId,
          eventId: randomUUID(),
          utmSource: attrRaw.utmSource || attrRaw.utm_source || undefined,
          utmMedium: attrRaw.utmMedium || attrRaw.utm_medium || undefined,
          utmCampaign: attrRaw.utmCampaign || attrRaw.utm_campaign || undefined,
          utmContent: attrRaw.utmContent || attrRaw.utm_content || undefined,
          utmTerm: attrRaw.utmTerm || attrRaw.utm_term || undefined,
          fbclid: attrRaw.fbclid || undefined,
          items: {
            create: [
              {
                productId: product.id,
                variantId: variant?.id,
                name: itemName,
                priceCents,
                options:
                  variant?.options &&
                  typeof variant.options === "object" &&
                  !Array.isArray(variant.options)
                    ? (variant.options as Prisma.InputJsonValue)
                    : undefined,
              },
            ],
          },
        },
        select: { id: true },
      });
      orderId = created.id;
    }

    return NextResponse.json({
      leadId: lead.id,
      personId: contact.id,
      orderId,
      clientRequestId,
      step,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao salvar progresso" },
      { status: 400 },
    );
  }
}
