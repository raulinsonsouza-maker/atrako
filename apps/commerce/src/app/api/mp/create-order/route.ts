import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { validateCoupon } from "@/lib/coupons";
import { isValidCpf, onlyDigits } from "@/lib/utils";
import { getOrCreatePaymentSettings, getConnectedMpAccount } from "@/lib/mercadopago/client";
import { createMercadoPagoOrder } from "@/lib/mercadopago/orders";
import { approveOrder } from "@/lib/orders";
import { getApprovedOrderFiles } from "@/lib/order-download";
import { randomUUID } from "crypto";

const schema = z.object({
  productId: z.string(),
  bumpProductId: z.string().optional(),
  email: z.string().email(),
  name: z.string().min(2),
  cpf: z.string().min(11),
  phone: z.string().optional().default(""),
  couponCode: z.string().optional(),
  termsAccepted: z.boolean(),
  payment: z.discriminatedUnion("type", [
    z.object({
      type: z.literal("credit_card"),
      token: z.string(),
      installments: z.number().int().min(1).max(24),
      paymentMethodId: z.string(),
    }),
    z.object({
      type: z.literal("pix"),
    }),
  ]),
  attribution: z
    .object({
      fbp: z.string().optional(),
      fbc: z.string().optional(),
      fbclid: z.string().optional(),
      utmSource: z.string().optional(),
      utmMedium: z.string().optional(),
      utmCampaign: z.string().optional(),
      utmContent: z.string().optional(),
      utmTerm: z.string().optional(),
      eventId: z.string().optional(),
    })
    .optional(),
  parentOrderId: z.string().optional(),
});

export async function POST(req: NextRequest) {
  try {
    const body = schema.parse(await req.json());
    if (!body.termsAccepted) {
      return NextResponse.json({ error: "Aceite os termos" }, { status: 400 });
    }
    if (!isValidCpf(body.cpf)) {
      return NextResponse.json({ error: "CPF inválido" }, { status: 400 });
    }

    const product = await prisma.product.findUnique({ where: { id: body.productId } });
    if (!product || product.status !== "PUBLISHED") {
      return NextResponse.json({ error: "Produto indisponível" }, { status: 404 });
    }

    let mainPriceCents = product.priceCents;
    if (body.parentOrderId) {
      const parent = await prisma.order.findUnique({
        where: { id: body.parentOrderId },
        include: { items: true },
      });
      const triggerIds = parent?.items.map((i) => i.productId) ?? [];
      const upsellOffer = await prisma.offer.findFirst({
        where: {
          offeredProductId: product.id,
          type: "POST_PURCHASE",
          active: true,
          ...(triggerIds.length ? { triggerProductId: { in: triggerIds } } : {}),
        },
      });
      if (upsellOffer) {
        mainPriceCents = Math.round(
          product.priceCents * (1 - upsellOffer.discountPercent / 100),
        );
      }
    }

    const items: { productId: string; name: string; priceCents: number }[] = [
      { productId: product.id, name: product.name, priceCents: mainPriceCents },
    ];

    if (body.bumpProductId) {
      const bumpOffer = await prisma.offer.findFirst({
        where: {
          triggerProductId: product.id,
          offeredProductId: body.bumpProductId,
          type: "ORDER_BUMP",
          active: true,
        },
        include: { offeredProduct: true },
      });
      if (bumpOffer) {
        const price = Math.round(
          bumpOffer.offeredProduct.priceCents * (1 - bumpOffer.discountPercent / 100),
        );
        items.push({
          productId: bumpOffer.offeredProduct.id,
          name: bumpOffer.offeredProduct.name,
          priceCents: price,
        });
      }
    }

    const subtotalCents = items.reduce((acc, i) => acc + i.priceCents, 0);
    let discountCents = 0;
    let couponId: string | undefined;
    if (body.couponCode) {
      const result = await validateCoupon(body.couponCode, product.id, subtotalCents);
      if (!result.ok) {
        return NextResponse.json({ error: result.error }, { status: 400 });
      }
      discountCents = result.discountCents;
      couponId = result.coupon.id;
    }
    const totalCents = Math.max(0, subtotalCents - discountCents);
    const eventId = body.attribution?.eventId || randomUUID();
    const fbclid = body.attribution?.fbclid;
    const fbc =
      body.attribution?.fbc ||
      (fbclid ? `fb.1.${Date.now()}.${fbclid}` : undefined);
    const settings = await getOrCreatePaymentSettings();

    const order = await prisma.order.create({
      data: {
        email: body.email.toLowerCase(),
        name: body.name,
        cpf: onlyDigits(body.cpf),
        phone: body.phone ? onlyDigits(body.phone) : null,
        status: "PENDING",
        subtotalCents,
        discountCents,
        totalCents,
        couponId,
        eventId,
        fbp: body.attribution?.fbp,
        fbc,
        fbclid,
        utmSource: body.attribution?.utmSource,
        utmMedium: body.attribution?.utmMedium,
        utmCampaign: body.attribution?.utmCampaign,
        utmContent: body.attribution?.utmContent,
        utmTerm: body.attribution?.utmTerm,
        parentOrderId: body.parentOrderId,
        termsAcceptedAt: new Date(),
        items: {
          create: items.map((item) => ({
            productId: item.productId,
            name: item.name,
            priceCents: item.priceCents,
            installments:
              body.payment.type === "credit_card" ? body.payment.installments : undefined,
          })),
        },
      },
      include: { items: true },
    });

    // Demo/dev: no MP connection, or credit_card with token "demo"
    const mpAccount = await getConnectedMpAccount();
    const isDemoToken =
      body.payment.type === "credit_card" &&
      body.payment.token === "demo" &&
      process.env.NODE_ENV !== "production";

    if (!mpAccount || isDemoToken) {
      if (process.env.NODE_ENV === "production") {
        return NextResponse.json(
          { error: "Pagamentos indisponíveis. Conecte o Mercado Pago." },
          { status: 503 },
        );
      }
      await approveOrder(order.id);
      const files = await getApprovedOrderFiles(order.id);
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "APPROVED",
        demoMode: true,
        files: files ?? [],
        redirectTo: `/upsell/check?orderId=${order.id}`,
      });
    }

    const [firstName, ...rest] = body.name.split(" ");
    const mpOrder = await createMercadoPagoOrder({
      externalReference: order.id,
      amount: totalCents / 100,
      description: product.name,
      statementDescriptor: settings.statementDescriptor,
      payer: {
        email: body.email,
        firstName,
        lastName: rest.join(" ") || firstName,
        identification: { type: "CPF", number: onlyDigits(body.cpf) },
      },
      payment:
        body.payment.type === "pix"
          ? { type: "bank_transfer", paymentMethodId: "pix" }
          : {
              type: "credit_card",
              token: body.payment.token,
              installments: body.payment.installments,
              paymentMethodId: body.payment.paymentMethodId,
            },
    });

    const payment = mpOrder.transactions?.payments?.[0];
    const pix = payment?.payment_method;

    await prisma.order.update({
      where: { id: order.id },
      data: {
        mpOrderId: mpOrder.id,
        mpPaymentId: payment?.id ? String(payment.id) : undefined,
        pixQrCode: pix?.qr_code,
        pixQrCodeBase64: pix?.qr_code_base64,
        pixCopyPaste: pix?.qr_code,
      },
    });

    const status = String(mpOrder.status || payment?.status || "PENDING").toLowerCase();
    if (status === "processed" || status === "approved" || status === "paid") {
      await approveOrder(order.id);
      const files = await getApprovedOrderFiles(order.id);
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "APPROVED",
        files: files ?? [],
        redirectTo: `/upsell/check?orderId=${order.id}`,
      });
    }

    if (body.payment.type === "pix") {
      return NextResponse.json({
        orderId: order.id,
        eventId,
        status: "PENDING",
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
      redirectTo: `/obrigado?orderId=${order.id}`,
    });
  } catch (e) {
    console.error(e);
    const message = e instanceof Error ? e.message : "Erro ao criar pedido";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
