/**
 * Importa o JSON gerado por export-store-snapshot.ts.
 * Roda dentro do container (Prisma linux): node import-store-snapshot.mjs /tmp/draxx-store.json
 */
const { readFileSync } = require("fs");
const { PrismaClient } = require("/app/lib/generated/prisma");

const file = process.argv[2];
if (!file) {
  console.error("uso: node import-store-snapshot.mjs <snapshot.json>");
  process.exit(1);
}

const data = JSON.parse(readFileSync(file, "utf8"));
const prisma = new PrismaClient();

function date(value) {
  return value ? new Date(value) : null;
}

async function main() {
  const clienteId = data.cliente.id;
  const bySlug = await prisma.cliente.findUnique({ where: { slug: data.cliente.slug } });
  if (bySlug && bySlug.id !== clienteId) {
    throw new Error(`slug ${data.cliente.slug} já pertence a outro workspace`);
  }
  const byStore = await prisma.commerceStore.findUnique({ where: { slug: data.store.slug } });
  if (byStore && byStore.id !== data.store.id) {
    throw new Error(`loja ${data.store.slug} já existe com outro id`);
  }

  await prisma.cliente.upsert({
    where: { id: clienteId },
    create: {
      id: clienteId,
      nome: data.cliente.nome,
      slug: data.cliente.slug,
      logoUrl: data.cliente.logoUrl,
      ativo: data.cliente.ativo !== false,
    },
    update: {
      nome: data.cliente.nome,
      logoUrl: data.cliente.logoUrl,
      ativo: data.cliente.ativo !== false,
    },
  });

  const settings = data.cliente.workspaceSettings;
  if (settings) {
    const prefs = {
      timezone: settings.timezone || "America/Sao_Paulo",
      currency: settings.currency || "BRL",
      locale: settings.locale || "pt-BR",
      primaryColor: settings.primaryColor,
      edition: settings.edition || "ecommerce",
      modulesEnabled: settings.modulesEnabled || {},
    };
    await prisma.workspaceSettings.upsert({
      where: { clienteId },
      create: { clienteId, ...prefs },
      update: prefs,
    });
  }

  for (const member of data.cliente.workspaceMembers || []) {
    await prisma.workspaceMember.upsert({
      where: { clienteId_email: { clienteId, email: member.email } },
      create: {
        clienteId,
        email: member.email,
        name: member.name,
        role: member.role,
        active: member.active !== false,
        passwordHash: member.passwordHash,
        passwordUpdatedAt: member.passwordHash ? new Date() : null,
      },
      update: {
        name: member.name,
        role: member.role,
        active: member.active !== false,
        passwordHash: member.passwordHash,
      },
    });
  }

  const store = data.store;
  const storeData = {
    clienteId,
    slug: store.slug,
    name: store.name,
    published: store.published,
    acceptingOrders: store.acceptingOrders,
    shipEnabled: store.shipEnabled,
    pickupEnabled: store.pickupEnabled,
    minOrderCents: store.minOrderCents,
    shippingRules: store.shippingRules ?? {},
    banners: store.banners ?? [],
    theme: store.theme ?? {},
    pickupName: store.pickupName,
    pickupAddress: store.pickupAddress,
    pickupInstructions: store.pickupInstructions,
  };
  await prisma.commerceStore.upsert({
    where: { id: store.id },
    create: { id: store.id, ...storeData },
    update: storeData,
  });

  for (const category of data.categories) {
    await prisma.commerceCategory.upsert({
      where: { id: category.id },
      create: {
        id: category.id,
        storeId: store.id,
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        active: category.active,
      },
      update: {
        name: category.name,
        slug: category.slug,
        imageUrl: category.imageUrl,
        sortOrder: category.sortOrder,
        active: category.active,
      },
    });
  }

  for (const product of data.products) {
    const productData = {
      clienteId,
      storeId: store.id,
      categoryId: product.categoryId,
      name: product.name,
      slug: product.slug,
      description: product.description,
      type: product.type,
      kind: product.kind,
      status: product.status,
      priceCents: product.priceCents,
      coverUrl: product.coverUrl,
      images: product.images ?? [],
      salesPage: product.salesPage,
      maxInstallments: product.maxInstallments,
      stockTracked: product.stockTracked,
      badges: product.badges ?? {},
      active: product.active,
    };
    await prisma.commerceProduct.upsert({
      where: { id: product.id },
      create: { id: product.id, ...productData },
      update: productData,
    });
    for (const variant of product.variants || []) {
      const variantData = {
        productId: product.id,
        sku: variant.sku,
        options: variant.options ?? {},
        priceCents: variant.priceCents,
        stockQty: variant.stockQty,
        active: variant.active,
        sortOrder: variant.sortOrder,
      };
      await prisma.commerceVariant.upsert({
        where: { id: variant.id },
        create: { id: variant.id, ...variantData },
        update: variantData,
      });
    }
  }

  for (const coupon of data.coupons || []) {
    await prisma.commerceCoupon.upsert({
      where: { id: coupon.id },
      create: {
        id: coupon.id,
        clienteId,
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        startsAt: date(coupon.startsAt),
        endsAt: date(coupon.endsAt),
        active: coupon.active,
      },
      update: {
        code: coupon.code,
        type: coupon.type,
        value: coupon.value,
        maxUses: coupon.maxUses,
        usedCount: coupon.usedCount,
        startsAt: date(coupon.startsAt),
        endsAt: date(coupon.endsAt),
        active: coupon.active,
      },
    });
    for (const link of coupon.products || []) {
      await prisma.commerceCouponProduct.upsert({
        where: { couponId_productId: { couponId: coupon.id, productId: link.productId } },
        create: { couponId: coupon.id, productId: link.productId },
        update: {},
      });
    }
  }

  for (const offer of data.offers || []) {
    await prisma.commerceOffer.upsert({
      where: { id: offer.id },
      create: {
        id: offer.id,
        clienteId,
        triggerProductId: offer.triggerProductId,
        offeredProductId: offer.offeredProductId,
        type: offer.type,
        discountPercent: offer.discountPercent,
        headline: offer.headline,
        description: offer.description,
        position: offer.position,
        active: offer.active,
      },
      update: {
        type: offer.type,
        discountPercent: offer.discountPercent,
        headline: offer.headline,
        description: offer.description,
        position: offer.position,
        active: offer.active,
      },
    });
  }

  for (const order of data.orders || []) {
    const { items, ...row } = order;
    await prisma.commerceOrder.upsert({
      where: { id: row.id },
      create: {
        ...row,
        clienteId,
        storeId: store.id,
        createdAt: date(row.createdAt) || undefined,
        updatedAt: date(row.updatedAt) || undefined,
      },
      update: {
        status: row.status,
        fulfillment: row.fulfillment,
        fulfillmentStatus: row.fulfillmentStatus,
        subtotalCents: row.subtotalCents,
        discountCents: row.discountCents,
        shippingFeeCents: row.shippingFeeCents,
        totalCents: row.totalCents,
      },
    });
    for (const item of items || []) {
      await prisma.commerceOrderItem.upsert({
        where: { id: item.id },
        create: {
          id: item.id,
          orderId: order.id,
          productId: item.productId,
          variantId: item.variantId,
          name: item.name,
          options: item.options,
          priceCents: item.priceCents,
          quantity: item.quantity,
          installments: item.installments,
        },
        update: {
          name: item.name,
          options: item.options,
          priceCents: item.priceCents,
          quantity: item.quantity,
        },
      });
    }
  }

  const check = await prisma.commerceStore.findUnique({
    where: { slug: store.slug },
    include: { _count: { select: { products: true, categories: true } } },
  });
  console.log(JSON.stringify({
    slug: check.slug,
    name: check.name,
    products: check._count.products,
    categories: check._count.categories,
  }));
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
