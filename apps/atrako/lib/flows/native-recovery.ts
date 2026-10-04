/**
 * Detecta recuperação de carrinho nativa ligada na loja (mensagem dobrada com os fluxos).
 * Só WooCommerce expõe isso por API (plugins ativos em /system_status); Shopify, Nuvemshop
 * e Tray não têm endpoint para o toggle — ficam no checklist manual.
 */

import { prisma } from "@/lib/db";
import { wcFetch } from "@/lib/integrations/woocommerce/client";

const WOO_RECOVERY_PLUGINS = [
  /abandon/i,
  /cart\s*recover/i,
  /recover.*cart/i,
  /cartflows/i,
  /retainful/i,
  /cartbounty/i,
  /woolentor.*abandon/i,
  /mailchimp.*woocommerce/i,
  /klaviyo/i,
  /omnisend/i,
  /rd\s*station/i,
];

export type NativeRecoveryDetection = {
  provider: string;
  checked: boolean;
  /** Plugins/recursos que provavelmente disparam recuperação própria. */
  suspects: string[];
  error?: string;
};

type WooSystemStatus = {
  active_plugins?: Array<{ plugin?: string; name?: string; version?: string }>;
};

async function detectWoo(workspaceId: string): Promise<NativeRecoveryDetection> {
  try {
    const status = await wcFetch<WooSystemStatus>(workspaceId, "/system_status");
    const suspects = (status.active_plugins ?? [])
      .map((p) => p.name || p.plugin || "")
      .filter((name) => name && WOO_RECOVERY_PLUGINS.some((re) => re.test(name)));
    return { provider: "woocommerce", checked: true, suspects: [...new Set(suspects)] };
  } catch (err) {
    return {
      provider: "woocommerce",
      checked: false,
      suspects: [],
      error: err instanceof Error ? err.message.slice(0, 200) : "Falha ao consultar a loja",
    };
  }
}

export async function detectNativeRecovery(workspaceId: string): Promise<NativeRecoveryDetection[]> {
  const conns = await prisma.workspaceConnection.findMany({
    where: { clienteId: workspaceId, status: "ACTIVE" },
    select: { provider: true },
  });
  const providers = new Set(conns.map((c) => c.provider));
  const out: NativeRecoveryDetection[] = [];
  if (providers.has("WOOCOMMERCE")) out.push(await detectWoo(workspaceId));
  return out;
}
