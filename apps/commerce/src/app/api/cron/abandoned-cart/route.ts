import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { sendAbandonedCartEmail } from "@/lib/email/templates/abandoned-cart";

const ABANDON_AFTER_MS = 45 * 60 * 1000;

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET?.trim();
  if (!secret) return false;
  const header = request.headers.get("authorization") || "";
  return header === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const cutoff = new Date(Date.now() - ABANDON_AFTER_MS);

  const candidates = await prisma.order.findMany({
    where: {
      status: "PENDING",
      abandonedEmailSentAt: null,
      createdAt: { lte: cutoff },
      email: { not: "" },
      items: { some: {} },
    },
    include: {
      items: {
        include: {
          product: true,
        },
        take: 1,
      },
    },
    take: 50,
    orderBy: { createdAt: "asc" },
  });

  let sent = 0;
  let skipped = 0;
  const errors: string[] = [];

  for (const order of candidates) {
    const primary = order.items[0];
    if (!primary || !order.email) {
      skipped += 1;
      continue;
    }

    // Marca antes do envio para idempotência (evita duplicar em retries concorrentes)
    const claimed = await prisma.order.updateMany({
      where: {
        id: order.id,
        status: "PENDING",
        abandonedEmailSentAt: null,
      },
      data: { abandonedEmailSentAt: new Date() },
    });
    if (claimed.count === 0) {
      skipped += 1;
      continue;
    }

    try {
      const hasPix = Boolean(order.pixCopyPaste || order.pixQrCode || order.pixQrCodeBase64);
      await sendAbandonedCartEmail({
        to: order.email,
        name: order.name || "Cliente",
        orderId: order.id,
        amountCents: order.totalCents,
        hasPix,
        product: {
          name: primary.product?.name ?? primary.name,
          slug: primary.product?.slug,
        },
      });
      sent += 1;
    } catch (err) {
      // Libera para retry futuro se o envio falhar
      await prisma.order.update({
        where: { id: order.id },
        data: { abandonedEmailSentAt: null },
      });
      errors.push(
        `${order.id}: ${err instanceof Error ? err.message : "erro desconhecido"}`,
      );
    }
  }

  return NextResponse.json({
    ok: true,
    candidates: candidates.length,
    sent,
    skipped,
    errors,
  });
}
