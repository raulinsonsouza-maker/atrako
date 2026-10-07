import { api } from "@/components/relacionamento/format";
import type { PhoneItem } from "@/components/relacionamento/phone/MessagePhone";
import type { WaPreview } from "@/lib/flows/wa-preview";

export const TRIGGER_LABEL: Record<string, string> = {
  cart_abandoned: "Carrinho abandonado",
  cart_aging_30: "Carrinho sem compra há 30 dias",
  cart_aging_60: "Carrinho sem compra há 60 dias",
  cart_aging_90: "Carrinho sem compra há 90 dias",
  order_unpaid: "Pedido aguardando pagamento",
  order_paid: "Pedido pago",
  second_purchase: "Depois da 1ª compra",
  repurchase_due: "Hora de recomprar",
  winback: "Cliente inativo",
  lead_lost: "Lead marcado como perdido",
  lead_welcome: "Novo cadastro",
  date_based: "Data importante",
};

export type StepPreview =
  | { kind: "email"; subject: string; preheader: string }
  | { kind: "whatsapp"; wa: WaPreview | null; templateStatus: string | null };

type PhoneStep = {
  id: string;
  delayMinutes: number;
  channel: "EMAIL" | "WHATSAPP";
  enabled: boolean;
  content: unknown;
  draftContent: unknown;
  couponCode: string | null;
  preview?: StepPreview;
};

/** "1 dia depois", "2 horas depois"… */
export function delayWords(minutes: number) {
  if (minutes <= 0) return "Na hora";
  const plural = (n: number, one: string, many: string) => `${n} ${n === 1 ? one : many}`;
  if (minutes < 60) return `${plural(minutes, "minuto", "minutos")} depois`;
  if (minutes < 1440 || minutes % 1440 !== 0) {
    const h = Math.round(minutes / 60);
    return h < 48 ? `${plural(h, "hora", "horas")} depois` : `${plural(Math.round(minutes / 1440), "dia", "dias")} depois`;
  }
  return `${plural(minutes / 1440, "dia", "dias")} depois`;
}

export function emailHtmlLoader(workspaceId: string, content: unknown, couponCode: string | null) {
  return () =>
    api<{ html: string }>("/api/atrako/relacionamento/flows", {
      body: { workspaceId, action: "preview", content, couponCode },
    }).then((r) => r.html);
}

/** Converte os passos de um fluxo na conversa do celular: gatilho → espera → mensagem… */
export function flowPhoneItems(workspaceId: string, trigger: string, steps: PhoneStep[]): PhoneItem[] {
  const items: PhoneItem[] = [{ kind: "trigger", label: `Quando: ${TRIGGER_LABEL[trigger] ?? trigger}` }];
  let prev = 0;
  for (const s of steps) {
    if (!s.enabled) continue;
    const gap = s.delayMinutes - prev;
    prev = s.delayMinutes;
    if (gap > 0) items.push({ kind: "delay", label: delayWords(gap) });
    if (s.channel === "EMAIL") {
      const p = s.preview?.kind === "email" ? s.preview : null;
      items.push({
        kind: "email",
        id: s.id,
        subject: p?.subject || "E-mail",
        preheader: p?.preheader || undefined,
        loadHtml: emailHtmlLoader(workspaceId, s.draftContent ?? s.content, s.couponCode),
      });
    } else {
      items.push({ kind: "whatsapp", id: s.id, preview: s.preview?.kind === "whatsapp" ? s.preview.wa : null });
    }
  }
  return items;
}
