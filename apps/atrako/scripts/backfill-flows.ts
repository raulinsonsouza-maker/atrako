/**
 * Backfill do módulo Relacionamento (rodar uma vez após o deploy, depois o cron mantém):
 *  1. CustomerProfile de todo contato com pedido (etapa, gasto, recompra prevista) — sem matricular em fluxos;
 *  2. aniversários lidos dos pedidos já gravados (Woo billing_birthdate, Tray birth_date,
 *     Nuvemshop, Shopify metafield) → ContactImportantDate (não sobrescreve edição manual);
 *  3. fluxos padrão criados PAUSADOS e templates WhatsApp recomendados enviados para aprovação.
 *
 * Dry-run por padrão. Uso:
 *   npx tsx scripts/backfill-flows.ts [--workspace <clienteId>] [--apply] [--no-templates]
 */
import "./server-only-shim.cjs";
import "dotenv/config";
import { prisma } from "@/lib/db";
import { recomputeAllProfiles } from "@/lib/flows/profile";
import { birthDateFromStorePayload, parseBirthDate, upsertContactBirthday } from "@/lib/flows/important-dates";
import { ensureDefaultFlows } from "@/lib/flows/playbooks";
import { ensureDefaultWaTemplates } from "@/lib/flows/wa-templates";

function argValue(flag: string): string | null {
  const i = process.argv.indexOf(flag);
  return i >= 0 ? (process.argv[i + 1] ?? null) : null;
}

async function backfillBirthdays(workspaceId: string | undefined, apply: boolean) {
  const tally = { pedidos: 0, comData: 0, gravados: 0, invalidos: 0 };
  let cursor: string | undefined;
  for (;;) {
    const rows = await prisma.marketplaceOrder.findMany({
      where: {
        provider: { in: ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"] },
        contactId: { not: null },
        ...(workspaceId ? { clienteId: workspaceId } : {}),
      },
      select: { id: true, clienteId: true, contactId: true, provider: true, rawPayload: true },
      orderBy: { id: "asc" },
      take: 500,
      ...(cursor ? { cursor: { id: cursor }, skip: 1 } : {}),
    });
    if (!rows.length) break;
    for (const o of rows) {
      tally.pedidos++;
      const raw = birthDateFromStorePayload(o.provider, o.rawPayload);
      if (!raw) continue;
      tally.comData++;
      if (!parseBirthDate(raw)) {
        tally.invalidos++;
        continue;
      }
      if (!apply) continue;
      const saved = await upsertContactBirthday({ workspaceId: o.clienteId, contactId: o.contactId!, raw, source: o.provider.toLowerCase() });
      if (saved) tally.gravados++;
    }
    cursor = rows[rows.length - 1].id;
  }
  return tally;
}

async function main() {
  const apply = process.argv.includes("--apply");
  const templates = !process.argv.includes("--no-templates");
  const workspaceId = argValue("--workspace") ?? undefined;

  const profiles = await recomputeAllProfiles({ workspaceId, dryRun: !apply, triggers: false });
  console.log("Perfis:", profiles);

  const birthdays = await backfillBirthdays(workspaceId, apply);
  console.log("Aniversários dos pedidos:", birthdays);

  const workspaces = await prisma.workspaceConnection.findMany({
    where: {
      status: "ACTIVE",
      provider: { in: ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY", "RESEND", "WHATSAPP"] },
      ...(workspaceId ? { clienteId: workspaceId } : {}),
    },
    distinct: ["clienteId"],
    select: { clienteId: true },
  });
  console.log(`Workspaces com loja, e-mail ou WhatsApp conectado: ${workspaces.length}`);

  if (!apply) {
    console.log("Dry-run. Rode com --apply para gravar.");
    return;
  }

  for (const { clienteId } of workspaces) {
    const flows = await ensureDefaultFlows(clienteId, { status: "PAUSED" });
    const tpl = templates ? await ensureDefaultWaTemplates(clienteId).catch((err: unknown) => ({ error: err instanceof Error ? err.message : String(err) })) : null;
    console.log(clienteId, { fluxos: flows, templates: tpl });
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
