import { api } from "@/components/relacionamento/format";
import type { PhoneChannel, PhoneItem } from "@/components/relacionamento/phone/MessagePhone";
import { isEmailContent, type EmailContent, type WhatsAppContent } from "@/lib/flows/types";
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

export const RESERVE_SUFFIX = ":reserva";
export const RESERVE_TAG = "Só para quem não recebe o WhatsApp";

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

/** "30 min", "5 h", "2 d". */
export function shortGap(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  if (minutes < 2880 && (minutes < 1440 || minutes % 1440 !== 0)) return `${Math.round(minutes / 60)} h`;
  return `${Math.round(minutes / 1440)} d`;
}

/** Tempo desde o gatilho: "na hora", "+5 h". */
export function sinceTrigger(minutes: number) {
  return minutes <= 0 ? "na hora" : `+${shortGap(minutes)}`;
}

/** E-mail reserva de um passo de WhatsApp (quando ligado e preenchido). */
export function reserveEmail(step: Pick<PhoneStep, "channel" | "content" | "draftContent">): EmailContent | null {
  if (step.channel !== "WHATSAPP") return null;
  const wa = (step.draftContent ?? step.content ?? {}) as WhatsAppContent;
  if (wa.fallbackToEmail === false || !isEmailContent(wa.fallbackEmail)) return null;
  return wa.fallbackEmail;
}

export function emailHtmlLoader(workspaceId: string, content: unknown, couponCode: string | null) {
  return () =>
    api<{ html: string }>("/api/atrako/relacionamento/flows", {
      body: { workspaceId, action: "preview", content, couponCode },
    }).then((r) => r.html);
}

/** Passos ligados de um canal, em ordem de envio. No e-mail entram também os e-mails reserva do WhatsApp. */
export function channelSteps<S extends PhoneStep>(steps: S[], channel: PhoneChannel) {
  return steps
    .filter((s) => s.channel === channel || (channel === "EMAIL" && reserveEmail(s)))
    .sort((a, b) => a.delayMinutes - b.delayMinutes);
}

/** Quantas mensagens cada tipo de contato recebe neste fluxo. */
export function channelSummary(steps: PhoneStep[]) {
  const on = steps.filter((s) => s.enabled);
  const wa = on.filter((s) => s.channel === "WHATSAPP").length;
  const email = on.filter((s) => s.channel === "EMAIL").length;
  const reserve = on.filter((s) => reserveEmail(s)).length;
  return {
    wa,
    email,
    reserve,
    waTab: steps.filter((s) => s.channel === "WHATSAPP").length,
    emailTab: steps.filter((s) => s.channel === "EMAIL" || reserveEmail(s)).length,
  };
}

/** Converte os passos de um canal na tela do celular: gatilho → espera → mensagem… */
export function flowPhoneItems(workspaceId: string, trigger: string, steps: PhoneStep[], channel: PhoneChannel): PhoneItem[] {
  const items: PhoneItem[] = [{ kind: "trigger", label: `Quando: ${TRIGGER_LABEL[trigger] ?? trigger}` }];
  let prev = 0;
  for (const s of channelSteps(steps, channel)) {
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
        time: sinceTrigger(s.delayMinutes),
        loadHtml: emailHtmlLoader(workspaceId, s.draftContent ?? s.content, s.couponCode),
      });
    } else if (channel === "EMAIL") {
      const r = reserveEmail(s);
      if (!r) continue;
      items.push({
        kind: "email",
        id: s.id + RESERVE_SUFFIX,
        subject: r.subject || "E-mail",
        preheader: r.preheader || undefined,
        time: sinceTrigger(s.delayMinutes),
        reserve: true,
        tag: RESERVE_TAG,
        loadHtml: emailHtmlLoader(workspaceId, r, s.couponCode),
      });
    } else {
      items.push({ kind: "whatsapp", id: s.id, preview: s.preview?.kind === "whatsapp" ? s.preview.wa : null });
    }
  }
  return items;
}
