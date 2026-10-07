"use client";

import { useQuery } from "@tanstack/react-query";
import { api } from "@/components/relacionamento/format";
import type { RelPeriod } from "@/components/relacionamento/period";

export type ChannelKpi = {
  sent: number;
  delivered: number;
  opened: number;
  clicked: number;
  bounced: number;
  complained: number;
  failed: number;
  costMicros: number;
};

export type AttentionItem = {
  key: string;
  tone: "warn" | "bad";
  title: string;
  detail?: string;
  tab?: string;
  sub?: string;
  href?: string;
};

export type Overview = {
  days: number;
  since: string;
  until: string;
  email: ChannelKpi;
  whatsapp: ChannelKpi;
  attributed: { orders: number; cents: number };
  influenced: { orders: number; cents: number };
  storeRevenue: { orders: number; cents: number };
  previous: { attributedCents: number; storeCents: number; emailSent: number; emailDelivered: number; emailClicked: number };
  daily: Array<{ day: string; channel: string; sent: number; opened: number; clicked: number; converted: number; cents: number }>;
  ranking: Array<{ flowId: string; name: string; status: string | null; sent: number; opened: number; clicked: number; converted: number; cents: number }>;
  subjects: Array<{ subject: string; sent: number; openRate: number; clickRate: number }>;
  links: Array<{ link: string; clicks: number }>;
  health: {
    resend: { connected: boolean; domain?: string | null; domainStatus?: string | null; webhook?: boolean; lastWebhookAt?: string | null; warmupDailyCap?: number | null };
    whatsapp: { connected: boolean; quality?: string | null; messagingLimit?: string | null; marketingMessagesStatus?: string | null };
    jobs: Array<{ job: string; lastAt: string | null; ok: boolean | null; stale: boolean; recentFailures: number }>;
  };
  attention: AttentionItem[];
  setup: { emailConnected: boolean; themePublished: boolean; flowsActive: boolean; datesEnabled: boolean; whatsappConnected: boolean };
  upcoming: Array<{ key: string; label: string; date: string; leadDays: number; hint: string | null; campaign: { id: string; status: string } | null }>;
  birthdays: { withDate: number; total: number; thisMonth: number };
  lifecycles: Array<{ lifecycle: string; label: string; count: number }>;
};

/** Uma consulta para Início e o painel do dashboard (mesma chave = mesmo cache). */
export function useOverview(workspaceId: string, period: RelPeriod) {
  return useQuery({
    queryKey: ["rel-overview", workspaceId, period.qs],
    queryFn: () => api<Overview>(`/api/atrako/relacionamento/overview?workspaceId=${workspaceId}&${period.qs}`),
    placeholderData: (prev) => prev,
  });
}

export { STAGE_LABEL as CAMPAIGN_STATUS } from "@/components/relacionamento/campaignStage";

/** Rótulos amigáveis para a qualidade do número na Meta. */
export const WA_QUALITY: Record<string, string> = { GREEN: "alta", YELLOW: "média", RED: "baixa", UNKNOWN: "—" };

export function rate(part: number, total: number) {
  return total ? part / total : 0;
}

/** Bounce > 4% ou spam > 0,1% derruba a reputação do domínio. */
export function deliverabilityBad(e: ChannelKpi) {
  return Boolean(e.sent && (e.bounced / e.sent > 0.04 || e.complained / e.sent > 0.001));
}
