/**
 * Preenche UF/cidade do pedido (a partir do rawPayload) e gênero do contato (primeiro nome).
 * Dry-run por padrão.
 *   npx tsx scripts/backfill-order-behavior.ts [--workspace <clienteId>] [--apply]
 */
import "./server-only-shim.cjs";
import "dotenv/config";
import { prisma } from "@/lib/db";
import { genderFromName } from "@/lib/geo/gender";
import { placeFromPayload } from "@/lib/commerce/order-behavior";

const apply = process.argv.includes("--apply");
const workspaceFlag = process.argv.indexOf("--workspace");
const workspaceId = workspaceFlag >= 0 ? process.argv[workspaceFlag + 1] : null;

async function main() {
  let cursor: string | undefined;
  let seen = 0;
  let places = 0;
  let genders = 0;

  for (;;) {
    const batch = await prisma.marketplaceOrder.findMany({
      take: 200,
      ...(cursor ? { skip: 1, cursor: { id: cursor } } : {}),
      orderBy: { id: "asc" },
      where: workspaceId ? { clienteId: workspaceId } : undefined,
      select: {
        id: true,
        provider: true,
        rawPayload: true,
        buyerName: true,
        stateUf: true,
        cityName: true,
        cityRaw: true,
        contact: { select: { id: true, name: true, gender: true } },
      },
    });
    if (!batch.length) break;
    cursor = batch[batch.length - 1].id;

    for (const order of batch) {
      seen += 1;
      const place = placeFromPayload(order.provider, order.rawPayload);
      const placeChanged =
        (place.stateUf ?? null) !== (order.stateUf ?? null) ||
        (place.cityName ?? null) !== (order.cityName ?? null) ||
        (place.cityRaw ?? null) !== (order.cityRaw ?? null);
      if (place.stateUf || place.cityName || place.cityRaw) {
        if (placeChanged) {
          places += 1;
          if (apply) {
            await prisma.marketplaceOrder.update({
              where: { id: order.id },
              data: place,
            });
          }
        }
      }

      const contact = order.contact;
      if (contact && !contact.gender) {
        const gender = genderFromName(contact.name || order.buyerName);
        if (gender) {
          genders += 1;
          if (apply) {
            await prisma.nativeContact.updateMany({
              where: { id: contact.id, gender: null },
              data: { gender },
            });
          }
        }
      }
    }
    console.log(`lidos ${seen} · lugares ${places} · gêneros ${genders}`);
  }

  console.log(apply ? "aplicado" : "dry-run (use --apply)");
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
