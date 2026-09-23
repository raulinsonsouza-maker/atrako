/**
 * Envio de mensagens WhatsApp Cloud API.
 * Templates fora da janela de 24h; texto/interactive dentro da janela.
 */

import { waFetch, getWhatsAppCredsOrThrow } from "./client";

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
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Falha ao enviar WhatsApp (${res.status})`);
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
    error?: { message?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.message || `Falha ao enviar CTA WhatsApp (${res.status})`);
  }
  return { wamid: data.messages?.[0]?.id ?? null };
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
