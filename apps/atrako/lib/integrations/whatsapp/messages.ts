/**
 * Envio de mensagens WhatsApp Cloud API.
 * Templates fora da janela de 24h; texto/interactive dentro da janela.
 */

import { waFetch, getWhatsAppCredsOrThrow } from "./client";

export class WaSendError extends Error {
  code: number | null;
  constructor(message: string, code: number | null) {
    super(message);
    this.code = code;
  }
}

export type SendTextInput = {
  workspaceId: string;
  to: string;
  body: string;
};

export type SendCtaUrlInput = {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  url: string;
};

export type SendTemplateInput = {
  workspaceId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  bodyParams?: string[];
  buttonUrlSuffix?: string;
};

function onlyDigitsPhone(phone: string) {
  return phone.replace(/\D/g, "");
}

export async function sendWhatsAppText(input: SendTextInput) {
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "text",
      text: { preview_url: true, body: input.body.slice(0, 4096) },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WaSendError(
      data.error?.message || `Falha ao enviar WhatsApp (${res.status})`,
      data.error?.code ?? null,
    );
  }
  return { wamid: data.messages?.[0]?.id ?? null };
}

export async function sendWhatsAppCtaUrl(input: SendCtaUrlInput) {
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "interactive",
      interactive: {
        type: "cta_url",
        body: { text: input.body.slice(0, 1024) },
        action: {
          name: "cta_url",
          parameters: {
            display_text: input.buttonText.slice(0, 20),
            url: input.url,
          },
        },
      },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WaSendError(
      data.error?.message || `Falha ao enviar CTA WhatsApp (${res.status})`,
      data.error?.code ?? null,
    );
  }
  return { wamid: data.messages?.[0]?.id ?? null };
}

export type ReplyButton = { id: string; title: string };

/** Até 3 botões de resposta rápida (janela de atendimento). */
export async function sendWhatsAppReplyButtons(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttons: ReplyButton[];
}) {
  const buttons = input.buttons.slice(0, 3).map((b) => ({
    type: "reply",
    reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
  }));
  if (!buttons.length) throw new WaSendError("Reply buttons vazios", null);
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "interactive",
      interactive: {
        type: "button",
        body: { text: input.body.slice(0, 1024) },
        action: { buttons },
      },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WaSendError(
      data.error?.message || `Falha ao enviar botões WhatsApp (${res.status})`,
      data.error?.code ?? null,
    );
  }
  return { wamid: data.messages?.[0]?.id ?? null };
}

export type ListRow = { id: string; title: string; description?: string };

/** Lista de seleção (até 10 linhas) — use quando houver 4+ opções. */
export async function sendWhatsAppList(input: {
  workspaceId: string;
  to: string;
  body: string;
  buttonText: string;
  sectionTitle?: string;
  rows: ListRow[];
}) {
  const rows = input.rows.slice(0, 10).map((r) => ({
    id: r.id.slice(0, 200),
    title: r.title.slice(0, 24),
    ...(r.description ? { description: r.description.slice(0, 72) } : {}),
  }));
  if (!rows.length) throw new WaSendError("Lista WhatsApp vazia", null);
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "interactive",
      interactive: {
        type: "list",
        body: { text: input.body.slice(0, 1024) },
        action: {
          button: input.buttonText.slice(0, 20),
          sections: [{ title: (input.sectionTitle || "Opções").slice(0, 24), rows }],
        },
      },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WaSendError(
      data.error?.message || `Falha ao enviar lista WhatsApp (${res.status})`,
      data.error?.code ?? null,
    );
  }
  return { wamid: data.messages?.[0]?.id ?? null };
}

/**
 * Template com componentes já montados (header imagem, body nomeado, botões URL/copy_code/
 * quick_reply, limited_time_offer, carrossel). `marketingApi` usa /marketing_messages (MM API).
 */
export async function sendWhatsAppTemplateComponents(input: {
  workspaceId: string;
  to: string;
  templateName: string;
  languageCode?: string;
  components: Array<Record<string, unknown>>;
  marketingApi?: boolean;
}) {
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const endpoint = input.marketingApi ? "marketing_messages" : "messages";
  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/${endpoint}`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode || "pt_BR" },
        ...(input.components.length ? { components: input.components } : {}),
      },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string; code?: number };
  };
  if (!res.ok) {
    throw new WaSendError(
      data.error?.message || `Falha ao enviar template WhatsApp (${res.status})`,
      data.error?.code ?? null,
    );
  }
  return { wamid: data.messages?.[0]?.id ?? null, templateName: input.templateName };
}

export async function sendWhatsAppTemplate(input: SendTemplateInput) {
  const creds = await getWhatsAppCredsOrThrow(input.workspaceId);
  const components: Array<Record<string, unknown>> = [];
  if (input.bodyParams?.length) {
    components.push({
      type: "body",
      parameters: input.bodyParams.map((text) => ({ type: "text", text })),
    });
  }
  if (input.buttonUrlSuffix) {
    components.push({
      type: "button",
      sub_type: "url",
      index: "0",
      parameters: [{ type: "text", text: input.buttonUrlSuffix }],
    });
  }

  const res = await waFetch(input.workspaceId, `/${creds.phoneNumberId}/messages`, {
    method: "POST",
    body: JSON.stringify({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: onlyDigitsPhone(input.to),
      type: "template",
      template: {
        name: input.templateName,
        language: { code: input.languageCode || "pt_BR" },
        ...(components.length ? { components } : {}),
      },
    }),
  });
  const data = (await res.json()) as {
    messages?: Array<{ id?: string }>;
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Falha ao enviar template WhatsApp (${res.status})`);
  }
  return { wamid: data.messages?.[0]?.id ?? null, templateName: input.templateName };
}
