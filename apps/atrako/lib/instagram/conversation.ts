import { DIRECT_LINK_THANKS } from "./directCopy";
import { looksLikeEmail } from "./messagingClient";

export type ConversationButton = { label: string; goTo: string };

export type ConversationStep =
  | { id: string; type: "message"; text: string; buttons: ConversationButton[] }
  | { id: string; type: "phone"; text: string; goTo: string | null }
  | { id: string; type: "email"; text: string; goTo: string | null }
  | { id: string; type: "link"; text: string; label: string; url: string; thanks: string; goTo: string | null }
  | { id: string; type: "handoff"; text: string };

export type Conversation = { steps: ConversationStep[] };

export type ConversationWait = "button" | "phone" | "email" | "link";

export type ConversationOutboundButton =
  | { type: "postback"; title: string; stepId: string }
  | { type: "web_url"; title: string; url: string; stepId: string };

export type ConversationOutbound = {
  text: string;
  buttons: ConversationOutboundButton[];
};

export type QualificationCapture = { field: "phone" | "email"; value: string };

export type ConversationAdvance = {
  send: ConversationOutbound | null;
  repeat: boolean;
  wait: ConversationWait | null;
  stepId: string | null;
  capture: QualificationCapture | null;
  handoff: boolean;
  status: "WAITING" | "COMPLETED";
};

export type ConversationPreviewItem =
  | { kind: "received"; text: string }
  | { kind: "action"; label: string; variant: "action" | "link" }
  | { kind: "sent"; text: string };

const PREFIX = "symbius_cv:";

export const STEP_TYPE_LABEL: Record<ConversationStep["type"], string> = {
  message: "Mensagem",
  phone: "Pedir telefone",
  email: "Pedir e-mail",
  link: "Abrir um link",
  handoff: "Encaminhar para a equipe",
};

function looksLikePhone(value: string): boolean {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 13;
}

function phoneDigits(value: string): string {
  return value.replace(/\D/g, "");
}

export function httpUrl(value: string): string | null {
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    return url.toString();
  } catch {
    return null;
  }
}

function asRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : null;
}

function stepIdOk(value: string): boolean {
  return /^[\w-]+$/.test(value) && value.length <= 40;
}

function readGoTo(value: unknown): string | null {
  const goTo = String(value ?? "").trim();
  return goTo && stepIdOk(goTo) ? goTo : null;
}

function readStep(value: unknown): ConversationStep | null {
  const row = asRecord(value);
  if (!row) return null;
  const id = String(row.id ?? "").trim();
  const type = String(row.type ?? "");
  if (!stepIdOk(id)) return null;
  const text = String(row.text ?? "").slice(0, 1000);
  if (type === "message") {
    const buttons = Array.isArray(row.buttons)
      ? row.buttons
          .map((item) => {
            const button = asRecord(item);
            if (!button) return null;
            const label = String(button.label ?? "").trim().slice(0, 20);
            const goTo = readGoTo(button.goTo);
            if (!label || !goTo) return null;
            return { label, goTo };
          })
          .filter((item): item is ConversationButton => Boolean(item))
          .slice(0, 3)
      : [];
    return { id, type, text, buttons };
  }
  if (type === "phone" || type === "email") {
    return { id, type, text, goTo: readGoTo(row.goTo) };
  }
  if (type === "link") {
    const url = httpUrl(String(row.url ?? "")) ?? "";
    return {
      id,
      type,
      text,
      label: String(row.label ?? "Acessar").trim().slice(0, 20) || "Acessar",
      url,
      thanks: String(row.thanks ?? "").trim().slice(0, 1000) || DIRECT_LINK_THANKS,
      goTo: readGoTo(row.goTo),
    };
  }
  if (type === "handoff") return { id, type, text };
  return null;
}

export function conversationFromConfig(cfg: unknown): Conversation | null {
  const row = asRecord(cfg);
  const source = row && "conversation" in row ? row.conversation : cfg;
  const body = asRecord(source);
  if (!body || !Array.isArray(body.steps)) return null;
  const steps = body.steps.map(readStep).filter((step): step is ConversationStep => Boolean(step));
  if (!steps.length) return null;
  const ids = new Set<string>();
  const unique = steps.filter((step) => {
    if (ids.has(step.id)) return false;
    ids.add(step.id);
    return true;
  });
  return unique.length ? { steps: unique } : null;
}

export function conversationStepPayload(fluxoId: string, stepId: string): string {
  return `${PREFIX}${fluxoId}:${stepId}`;
}

export function parseConversationStepPayload(payload: string): { fluxoId: string; stepId: string } | null {
  if (!payload.startsWith(PREFIX)) return null;
  const rest = payload.slice(PREFIX.length);
  const split = rest.indexOf(":");
  if (split <= 0) return null;
  const fluxoId = rest.slice(0, split).trim();
  const stepId = rest.slice(split + 1).trim();
  if (!fluxoId || !stepIdOk(stepId)) return null;
  return { fluxoId, stepId };
}

export function defaultConversation(): Conversation {
  return {
    steps: [
      {
        id: "abrir",
        type: "message",
        text: "Olá! Que bom receber seu contato. Como podemos ajudar?",
        buttons: [{ label: "Quero saber mais", goTo: "telefone" }],
      },
      {
        id: "telefone",
        type: "phone",
        text: "Qual é o seu telefone com DDD?",
        goTo: "email",
      },
      {
        id: "email",
        type: "email",
        text: "Qual é o seu e-mail?",
        goTo: null,
      },
    ],
  };
}

export function nextStepId(steps: ConversationStep[]): string {
  const ids = new Set(steps.map((step) => step.id));
  let n = steps.length + 1;
  while (ids.has(`p${n}`)) n += 1;
  return `p${n}`;
}

export function emptyStep(type: ConversationStep["type"], id: string): ConversationStep {
  if (type === "message") return { id, type, text: "", buttons: [] };
  if (type === "phone") return { id, type, text: "Qual é o seu telefone com DDD?", goTo: null };
  if (type === "email") return { id, type, text: "Qual é o seu e-mail?", goTo: null };
  if (type === "link") {
    return { id, type, text: "Aqui está o link.", label: "Acessar", url: "", thanks: DIRECT_LINK_THANKS, goTo: null };
  }
  return { id, type, text: "Vou chamar alguém da equipe para continuar com você." };
}

export function stepOptionLabel(step: ConversationStep, index: number): string {
  const line = step.text.trim().split("\n")[0]?.slice(0, 32) ?? "";
  return line || `${index + 1}. ${STEP_TYPE_LABEL[step.type]}`;
}

export function conversationProblems(conversation: Conversation): string | null {
  if (!conversation.steps.length) return "Adicione um passo";
  const ids = new Set(conversation.steps.map((step) => step.id));
  for (const step of conversation.steps) {
    if (!step.text.trim() && step.type !== "handoff") {
      if (step.type === "phone" || step.type === "email") return "Escreva a pergunta";
      return "Escreva a mensagem";
    }
    if (step.type === "message") {
      for (const button of step.buttons) {
        if (!button.label.trim()) return "Escreva o texto do botão";
        if (!ids.has(button.goTo) || button.goTo === step.id) return "Escolha para onde o botão segue";
      }
    }
    if ((step.type === "phone" || step.type === "email" || step.type === "link") && step.goTo && !ids.has(step.goTo)) {
      return "Escolha o próximo passo";
    }
    if (step.type === "link" && !httpUrl(step.url)) return "Informe um link http ou https";
  }
  return null;
}

function findStep(conversation: Conversation, id: string | null): ConversationStep | null {
  if (!id) return null;
  return conversation.steps.find((step) => step.id === id) ?? null;
}

function enter(conversation: Conversation, step: ConversationStep): ConversationAdvance | null {
  if (step.type === "message") {
    const buttons = step.buttons.filter((button) => conversation.steps.some((item) => item.id === button.goTo));
    return {
      send: {
        text: step.text.trim(),
        buttons: buttons.map((button) => ({ type: "postback", title: button.label.slice(0, 20), stepId: button.goTo })),
      },
      repeat: false,
      wait: buttons.length ? "button" : null,
      stepId: step.id,
      capture: null,
      handoff: false,
      status: buttons.length ? "WAITING" : "COMPLETED",
    };
  }
  if (step.type === "phone" || step.type === "email") {
    return {
      send: { text: step.text.trim(), buttons: [] },
      repeat: false,
      wait: step.type,
      stepId: step.id,
      capture: null,
      handoff: false,
      status: "WAITING",
    };
  }
  if (step.type === "link") {
    const url = httpUrl(step.url);
    if (!url) return null;
    return {
      send: {
        text: step.text.trim(),
        buttons: [{ type: "web_url", title: step.label.slice(0, 20) || "Acessar", url, stepId: step.id }],
      },
      repeat: false,
      wait: step.goTo ? "link" : null,
      stepId: step.id,
      capture: null,
      handoff: false,
      status: step.goTo ? "WAITING" : "COMPLETED",
    };
  }
  return {
    send: step.text.trim() ? { text: step.text.trim(), buttons: [] } : null,
    repeat: false,
    wait: null,
    stepId: step.id,
    capture: null,
    handoff: true,
    status: "COMPLETED",
  };
}

export function advanceConversation(input: {
  conversation: Conversation;
  stepId: string | null;
  wait: ConversationWait | null;
  event: { kind: "start" } | { kind: "goto"; stepId: string } | { kind: "text"; text: string };
}): ConversationAdvance | null {
  if (input.event.kind === "start") {
    const first = input.conversation.steps[0];
    return first ? enter(input.conversation, first) : null;
  }
  if (input.event.kind === "goto") {
    const step = findStep(input.conversation, input.event.stepId);
    return step ? enter(input.conversation, step) : null;
  }

  const current = findStep(input.conversation, input.stepId);
  if (!current || (input.wait !== "phone" && input.wait !== "email")) {
    return {
      send: null,
      repeat: false,
      wait: input.wait,
      stepId: input.stepId,
      capture: null,
      handoff: false,
      status: "WAITING",
    };
  }
  if (current.type !== "phone" && current.type !== "email") return null;

  const text = input.event.text.trim();
  const valid = current.type === "phone" ? looksLikePhone(text) : looksLikeEmail(text);
  if (!valid) {
    return {
      send: { text: current.text.trim(), buttons: [] },
      repeat: true,
      wait: current.type,
      stepId: current.id,
      capture: null,
      handoff: false,
      status: "WAITING",
    };
  }

  const capture: QualificationCapture =
    current.type === "phone"
      ? { field: "phone", value: phoneDigits(text) }
      : { field: "email", value: text.toLowerCase() };
  const target = current.goTo ? findStep(input.conversation, current.goTo) : null;
  const next = target ? enter(input.conversation, target) : null;
  if (!next) {
    return {
      send: null,
      repeat: false,
      wait: null,
      stepId: current.id,
      capture,
      handoff: false,
      status: "COMPLETED",
    };
  }
  return { ...next, capture };
}

function previewStep(step: ConversationStep, sample: boolean): ConversationPreviewItem[] {
  const items: ConversationPreviewItem[] = [];
  if (step.text.trim()) items.push({ kind: "received", text: step.text.trim() });
  if (step.type === "message") {
    for (const button of step.buttons) {
      items.push({ kind: "action", label: button.label, variant: "action" });
    }
  }
  if (step.type === "link") {
    items.push({ kind: "action", label: step.label || "Acessar", variant: "link" });
    if (step.thanks.trim()) items.push({ kind: "received", text: step.thanks.trim() });
  }
  if (sample && step.type === "phone") items.push({ kind: "sent", text: "11999999999" });
  if (sample && step.type === "email") items.push({ kind: "sent", text: "nome@email.com" });
  return items;
}

export function conversationPreview(conversation: Conversation, focusStepId: string | null): ConversationPreviewItem[] {
  const first = conversation.steps[0];
  if (!first) return [];
  const items = previewStep(first, first.type === "phone" || first.type === "email");
  const focus = focusStepId && focusStepId !== first.id ? findStep(conversation, focusStepId) : null;
  if (focus) items.push(...previewStep(focus, true));
  return items;
}
