import { NextRequest, NextResponse } from "next/server";
import { randomUUID } from "crypto";
import { prisma } from "@/lib/db";
import {
  approveOrder,
  isValidCpf,
  onlyDigits,
  validateCoupon,
} from "@/lib/commerce/orders";
import { createMercadoPagoOrder } from "@/lib/commerce/mp";
import { resolveMercadoPago } from "@/lib/config/resolveConnection";
import { upsertPersonAndLead } from "@/lib/atrako/person";
import { isPublicModuleEnabled } from "@/lib/modules/resolve";
import { createEvent, publishEventBatch } from "@atrako/events";
import { Prisma } from "@/lib/generated/prisma";

export async function POST(request: NextRequest) {
  try {
    const body = (await request.json()) as Record<string, unknown>;
    const productId = typeof body.productId === "string" ? body.productId : "";
    const email = typeof body.email === "string" ? body.email.trim().toLowerCase() : "";
    const name = typeof body.name === "string" ? body.name.trim() : "";
    const cpf = typeof body.cpf === "string" ? body.cpf : "";
    const phone = typeof body.phone === "string" ? body.phone : "";
    const termsAccepted = body.termsAccepted === true;
    const couponCode = typeof body.couponCode === "string" ? body.couponCode : undefined;
    const bumpProductId = typeof body.bumpProductId === "string" ? body.bumpProductId : undefined;
    const parentOrderId = typeof body.parentOrderId === "string" ? body.parentOrderId : undefined;
    const payment = body.payment as Record<string, unknown> | undefined;

    if (!productId || !email || !name || !termsAccepted || !payment) {
      return NextResponse.json({ error: "Dados incompletos" }, { status: 400 });
    }
    if (!isValidCpf(cpf)) {
      return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
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

    const variantId = typeof body.variantId === "string" ? body.variantId : "";
    const variant =
      variantId && product.variants.length
        ? product.variants.find((v) => v.id === variantId) ?? null
        : null;
    if (product.variants.length > 0 && !variant) {
      return NextResponse.json({ error: "Selecione a medida / variante" }, { status: 400 });
    }

    let mainPriceCents = variant?.priceCents ?? product.priceCents;
    let itemName = product.name;
    if (variant) {
      const opts =
        variant.options && typeof variant.options === "object" && !Array.isArray(variant.options)
          ? (variant.options as Record<string, string>)
          : {};
      const label = Object.values(opts).filter(Boolean).join(" · ");
      if (label) itemName = `${product.name} — ${label}`;
    }
    if (parentOrderId) {
      const parent = await prisma.commerceOrder.findUnique({
        where: { id: parentOrderId },
        include: { items: true },
      });
      const triggerIds = parent?.items.map((i) => i.productId) ?? [];
      const upsellOffer = await prisma.commerceOffer.findFirst({
        where: {
          clienteId: product.clienteId,
          offeredProductId: product.id,
          type: "POST_PURCHASE",
          active: true,
          ...(triggerIds.length ? { triggerProductId: { in: triggerIds } } : {}),
        },
      });
      if (upsellOffer) {
        mainPriceCents = Math.round(mainPriceCents * (1 - upsellOffer.discountPercent / 100));
      }
    }

    const items: Array<{
      productId: string;
      name: string;
      priceCents: number;
      variantId?: string;
      options?: Record<string, string>;
    }> = [
      {
        productId: product.id,
        name: itemName,
        priceCents: mainPriceCents,
        variantId: variant?.id,
        options:
          variant?.options && typeof variant.options === "object" && !Array.isArray(variant.options)
            ? (variant.options as Record<string, string>)
            : undefined,
      },
    ];

    if (bumpProductId) {
      const bumpOffer = await prisma.commerceOffer.findFirst({
        where: {
          clienteId: product.clienteId,
          triggerProductId: product.id,
          offeredProductId: bumpProductId,
          type: "ORDER_BUMP",
          active: true,
        },
        include: { offeredProduct: true },
      });
      if (bumpOffer) {
        items.push({
          productId: bumpOffer.offeredProduct.id,
          name: bumpOffer.offeredProduct.name,
          priceCents: Math.round(
            bumpOffer.offeredProduct.priceCents * (1 - bumpOffer.discountPercent / 100),
          ),
        });
      }
    }

    const subtotalCents = items.reduce((a, i) => a + i.priceCents, 0);
    let discountCents = 0;
    let couponId: string | undefined;
    if (couponCode) {
      const result = await validateCoupon(product.clienteId, couponCode, product.id, subtotalCents);
      if (!result.ok) return NextResponse.json({ error: result.error }, { status: 400 });
      discountCents = result.discountCents;
      couponId = result.coupon.id;
    }

    // Desconto Pix: salesPage.pixDiscountPercent ou theme da loja.
    let pixDiscountPercent = 0;
    if (payment?.type === "pix") {
      const sales =
        product.salesPage && typeof product.salesPage === "object" && !Array.isArray(product.salesPage)
          ? (product.salesPage as Record<string, unknown>)
          : {};
      if (typeof sales.pixDiscountPercent === "number" && sales.pixDiscountPercent > 0) {
        pixDiscountPercent = Math.min(100, Math.round(sales.pixDiscountPercent));
      } else if (product.storeId) {
        const store = await prisma.commerceStore.findUnique({
          where: { id: product.storeId },
          select: { theme: true },
        });
        const theme =
          store?.theme && typeof store.theme === "object" && !Array.isArray(store.theme)
            ? (store.theme as Record<string, unknown>)
            : {};
        if (typeof theme.pixDiscountPercent === "number" && theme.pixDiscountPercent > 0) {
          pixDiscountPercent = Math.min(100, Math.round(theme.pixDiscountPercent));
        }
      }
      if (pixDiscountPercent > 0) {
        discountCents += Math.round(((subtotalCents - discountCents) * pixDiscountPercent) / 100);
      }
    }

    const shippingAddress =
      body.shippingAddress && typeof body.shippingAddress === "object"
        ? (body.shippingAddress as Record<string, unknown>)
        : null;
    const fulfillment =
      typeof body.fulfillment === "string" && body.fulfillment.trim()
        ? body.fulfillment.trim().toUpperCase()
        : product.kind === "PHYSICAL"
          ? "SHIP"
          : "DIGITAL";
    const totalCents = Math.max(0, subtotalCents - discountCents);
    const eventId =
      typeof (body.attribution as { eventId?: string } | undefined)?.eventId === "string"
        ? (body.attribution as { eventId: string }).eventId
        : randomUUID();
    const attrRaw = (body.attribution as Record<string, string> | undefined) ?? {};
    const pageSlug =
      (typeof body.pageSlug === "string" && body.pageSlug.trim()) ||
      attrRaw.pageSlug ||
      undefined;
    const pageProductId =
      (typeof body.pageProductId === "string" && body.pageProductId.trim()) ||
      attrRaw.pageProductId ||
      undefined;
    const productType =
      (typeof body.productType === "string" && body.productType.trim()) ||
      attrRaw.productType ||
      product.type;

    const leadSource = pageSlug
      ? `lp:${pageSlug}`
      : `checkout:${product.slug}`;

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
        productType,
        productName: product.name,
        priceCents: product.priceCents,
        // pageSlug/pageUrl/pageProductId: first-touch preservado no merge se já existirem
        pageSlug,
        pageProductId,
        pageUrl: attrRaw.pageUrl,
        checkoutProductId: product.id,
        referrer: attrRaw.referrer,
        gclid: attrRaw.gclid,
        fbclid: attrRaw.fbclid,
        orderPending: true,
      },
    });

    const attr = {
      ...attrRaw,
      utmSource: attrRaw.utmSource || attrRaw.utm_source,
      utmMedium: attrRaw.utmMedium || attrRaw.utm_medium,
      utmCampaign: attrRaw.utmCampaign || attrRaw.utm_campaign,
      utmContent: attrRaw.utmContent || attrRaw.utm_content,
      utmTerm: attrRaw.utmTerm || attrRaw.utm_term,
      fbclid: attrRaw.fbclid,
      fbp: attrRaw.fbp,
      fbc: attrRaw.fbc,
    };
    const order = await prisma.commerceOrder.create({
      data: {
        clienteId: product.clienteId,
        storeId: product.storeId ?? undefined,
        productId: product.id,
        contactId: contact.id,
        email,
        name,
        cpf: onlyDigits(cpf),
        phone: phone ? onlyDigits(phone) : null,
        status: "PENDING",
        subtotalCents,
        discountCents,
        shippingFeeCents: 0,
        totalCents,
        fulfillment,
        fulfillmentStatus: fulfillment === "SHIP" ? "NEW" : "NEW",
        shippingAddress: shippingAddress
          ? ({
              street: String(shippingAddress.street ?? "").slice(0, 200),
              number: String(shippingAddress.number ?? "").slice(0, 40),
              complement: String(shippingAddress.complement ?? "").slice(0, 120) || undefined,
              neighborhood: String(shippingAddress.neighborhood ?? "").slice(0, 120) || undefined,
              city: String(shippingAddress.city ?? "").slice(0, 120),
              state: String(shippingAddress.state ?? "").slice(0, 2).toUpperCase(),
              cep: onlyDigits(String(shippingAddress.cep ?? "")).slice(0, 8),
            } as Prisma.InputJsonValue)
          : undefined,
        couponId,
        eventId,
        fbp: attr.fbp,
        fbc: attr.fbc,
        fbclid: attr.fbclid,
        utmSource: attr.utmSource,
        utmMedium: attr.utmMedium,
        utmCampaign: attr.utmCampaign,
        utmContent: attr.utmContent,
        utmTerm: attr.utmTerm,
        parentOrderId,
        termsAcceptedAt: new Date(),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            variantId: item.variantId,
            options: item.options,
            name: item.name,
            priceCents: item.priceCents,
            installments:
              payment.type === "credit_card" && typeof payment.installments === "number"
                ? payment.installments
                : undefined,
          })),
        },
      },
      include: { items: true },
    });

    await publishEventBatch([
      createEvent({
        name: parentOrderId ? "order.completed" : "lead.created",
        source: "commerce",
        idempotencyKey: `commerce-checkout-${order.id}`,
        context: {
          workspaceId: product.clienteId,
          contactId: contact.id,
          leadId: lead.id,
        },
        payload: {
          orderId: order.id,
          productId: product.id,
          productType,
          email,
          phone: order.phone,
          amount: totalCents / 100,
          parentOrderId,
          pageSlug,
          pageProductId,
          utmSource: attr.utmSource,
          utmCampaign: attr.utmCampaign,
        },
      }),
    ]).catch(() => null);

    const mp = await resolveMercadoPago(product.clienteId);
    const isDemo =
      payment.type === "credit_card" &&
      payment.token === "demo" &&
      process.env.NODE_ENV !== "production";

    if (!mp || isDemo) {
      if (process.env.NODE_ENV === "production" && !mp) {
        return NextResponse.json(
          { error: "Mercado Pago não conectado. Vá em Config → Conexões." },
          { status: 503 },
        );
      }
      await approveOrder(order.id);
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "APPROVED",
        totalCents,
        demoMode: !mp || isDemo,
        redirectTo: `/upsell/check?orderId=${order.id}`,
      });
    }

    const [firstName, ...rest] = name.split(" ");
    const mpOrder = await createMercadoPagoOrder({
      workspaceId: product.clienteId,
      externalReference: order.id,
      amount: totalCents / 100,
      description: product.name,
      payer: {
        email,
        firstName,
        lastName: rest.join(" ") || firstName,
        identification: { type: "CPF", number: onlyDigits(cpf) },
      },
      payment:
        payment.type === "pix"
          ? { type: "bank_transfer", paymentMethodId: "pix" }
          : {
              type: "credit_card",
              token: String(payment.token),
              installments: Number(payment.installments) || 1,
              paymentMethodId: String(payment.paymentMethodId || "visa"),
            },
    });

    const pay = mpOrder.transactions?.payments?.[0];
    const pix = pay?.payment_method;

    await prisma.commerceOrder.update({
      where: { id: order.id },
      data: {
        mpOrderId: mpOrder.id,
        mpPaymentId: pay?.id ? String(pay.id) : null,
        pixQrCode: pix?.qr_code ?? null,
        pixQrCodeBase64: pix?.qr_code_base64 ?? null,
        pixCopyPaste: pix?.qr_code ?? null,
      },
    });

    const status = String(mpOrder.status || pay?.status || "PENDING").toLowerCase();
    if (["processed", "approved", "paid"].some((x) => status.includes(x))) {
      await approveOrder(order.id);
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "APPROVED",
        totalCents,
        redirectTo: `/upsell/check?orderId=${order.id}`,
      });
    }

    if (payment.type === "pix") {
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "PENDING",
        totalCents,
        redirectTo: `/checkout/pix/${order.id}`,
        pixQrCode: pix?.qr_code,
        pixQrCodeBase64: pix?.qr_code_base64,
        pixCopyPaste: pix?.qr_code,
      });
    }

    return NextResponse.json({
      orderId: order.id,
      eventId,
      status: "PENDING",
      totalCents,
      redirectTo: `/obrigado?orderId=${order.id}`,
    });
  } catch (e) {
    console.error(e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : "Erro ao criar pedido" },
      { status: 400 },
    );
  }
}
