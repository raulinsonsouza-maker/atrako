import { prisma } from "../lib/db";
import { asShippingRules } from "../lib/commerce/shipping";

async function main() {
  console.log("has commerceStore", typeof (prisma as { commerceStore?: unknown }).commerceStore);
  const store = await prisma.commerceStore.findUnique({
    where: { slug: "draxx" },
    include: {
      categories: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  console.log("store", store?.id, store?.name, store?.published);
  if (!store) return;

  const products = await prisma.commerceProduct.findMany({
    where: {
      storeId: store.id,
      kind: "PHYSICAL",
      active: true,
      status: "PUBLISHED",
    },
    include: {
      variants: { where: { active: true }, orderBy: { sortOrder: "asc" } },
    },
  });
  console.log("products", products.length);
  console.log("rules", asShippingRules(store.shippingRules));

  try {
    const { getWorkspaceConfig, resolveBrand } = await import("../lib/config/getWorkspaceConfig");
    const config = await getWorkspaceConfig(store.clienteId);
    console.log("brand", config ? resolveBrand(config) : null);
  } catch (e) {
    console.error("getWorkspaceConfig failed", e);
  }

  try {
    const { isPublicModuleEnabled } = await import("../lib/modules/resolve");
    console.log("module enabled", await isPublicModuleEnabled(store.clienteId, "commerce"));
  } catch (e) {
    console.error("isPublicModuleEnabled failed", e);
  }
}

main()
  .catch((e) => {
    console.error("FAIL", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
