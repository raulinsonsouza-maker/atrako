import { prisma } from "@/lib/db";
import { syncMetaAdPurchases, type MetaPurchaseSyncResult } from "./meta-purchases";
import { reconcileOrderSources, type ReconcileResult } from "./reconcile";

export { reconcileOrderSources } from "./reconcile";
export { CHANNEL_LABELS, type OrderChannel } from "./store-source";

const SITE_PROVIDERS = ["WOOCOMMERCE", "SHOPIFY", "NUVEMSHOP", "TRAY"];
/** Meta revisa conversões por alguns dias; a janela de 7 dias de clique também atrasa a contagem. */
const INCREMENTAL_DAYS = 35;
const BACKFILL_DAYS = 180;

function isoDay(d: Date) {
  return d.toISOString().slice(0, 10);
}

export type CommerceAttributionResult = {
  skipped?: string;
  meta?: MetaPurchaseSyncResult;
  reconcile?: ReconcileResult;
};

/** Sincroniza compras do Meta e reconcilia com os pedidos do site. Seguro para rodar todo dia. */
export async function refreshCommerceAttribution(
  clienteId: string,
  options?: { dateFrom?: string; dateTo?: string },
): Promise<CommerceAttributionResult> {
  const hasSiteOrders = await prisma.marketplaceOrder.findFirst({
    where: { clienteId, provider: { in: SITE_PROVIDERS } },
    select: { id: true },
  });
  if (!hasSiteOrders) return { skipped: "sem pedidos de loja" };

  const dateTo = options?.dateTo ?? isoDay(new Date());
  let dateFrom = options?.dateFrom;
  if (!dateFrom) {
    const synced = await prisma.metaAdPurchaseDaily.findFirst({ where: { clienteId }, select: { id: true } });
    const back = new Date();
    back.setUTCDate(back.getUTCDate() - (synced ? INCREMENTAL_DAYS : BACKFILL_DAYS));
    dateFrom = isoDay(back);
  }

  const hasMeta = await prisma.conta.findFirst({ where: { clienteId, plataforma: "META" }, select: { id: true } });
  let meta: MetaPurchaseSyncResult | undefined;
  if (hasMeta) {
    meta = await syncMetaAdPurchases(clienteId, { dateFrom, dateTo }).catch((e) => ({
      accounts: 0,
      rows: 0,
      error: e instanceof Error ? e.message : String(e),
    }));
  }
  const reconcile = await reconcileOrderSources(clienteId, { dateFrom, dateTo });
  return { meta, reconcile };
}

/** Etapa do sync diário: todos os clientes com pedidos de loja. */
export async function refreshCommerceAttributionTodosClientes(): Promise<Array<{ clienteId: string; error?: string }>> {
  const clientes = await prisma.marketplaceOrder.findMany({
    where: { provider: { in: SITE_PROVIDERS } },
    distinct: ["clienteId"],
    select: { clienteId: true },
  });
  const out: Array<{ clienteId: string; error?: string }> = [];
  for (const { clienteId } of clientes) {
    try {
      const r = await refreshCommerceAttribution(clienteId);
      out.push({ clienteId, error: r.meta?.error && r.meta.error !== "Meta não conectada" ? r.meta.error : undefined });
    } catch (e) {
      out.push({ clienteId, error: e instanceof Error ? e.message : String(e) });
    }
  }
  return out;
}
