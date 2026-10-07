/**
 * Prévia visual de um modelo do WhatsApp a partir dos `components` da Meta.
 * Sem dependências de servidor: usado pela API (passos dos fluxos) e pelas telas (modelos, campanha).
 */

export type WaPreviewButton = { text: string; kind: "url" | "copy" | "reply" | "phone" | "other" };

export type WaPreview = {
  body: string;
  imageHeader: boolean;
  headerText?: string;
  footer?: string;
  buttons: WaPreviewButton[];
};

/** Valores de exemplo dos parâmetros nomeados (mesmos do envio). */
export const WA_EXAMPLE_PARAMS: Record<string, string> = {
  first_name: "Maria",
  product_name: "Tênis Runner",
  store_name: "Loja Exemplo",
  coupon_code: "VOLTA10",
  order_ref: "#1234",
  order_total: "R$ 189,90",
  expires: "até domingo",
};

type Comp = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; text?: string }>;
};

function fill(text: string, params: Record<string, string>) {
  return text.replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi, (_, k: string) => params[k] ?? `{{${k}}}`);
}

function buttonKind(type: string): WaPreviewButton["kind"] {
  const t = type.toUpperCase();
  if (t === "URL") return "url";
  if (t === "COPY_CODE") return "copy";
  if (t === "QUICK_REPLY") return "reply";
  if (t === "PHONE_NUMBER") return "phone";
  return "other";
}

export function waPreviewFromComponents(components: unknown, params: Record<string, string> = WA_EXAMPLE_PARAMS): WaPreview {
  const comps = (Array.isArray(components) ? components : []) as Comp[];
  const find = (type: string) => comps.find((c) => (c.type ?? "").toUpperCase() === type);
  const header = find("HEADER");
  const format = (header?.format ?? "").toUpperCase();
  return {
    body: fill(find("BODY")?.text ?? "", params),
    imageHeader: format === "IMAGE" || format === "VIDEO" || Boolean(find("CAROUSEL")),
    headerText: format === "TEXT" && header?.text ? fill(header.text, params) : undefined,
    footer: find("FOOTER")?.text || undefined,
    buttons: (find("BUTTONS")?.buttons ?? []).map((b) => ({
      text: b.text || (String(b.type).toUpperCase() === "COPY_CODE" ? "Copiar código" : "Botão"),
      kind: buttonKind(b.type ?? ""),
    })),
  };
}

/** Prévia de um texto livre (modelo ainda não criado na Meta). */
export function waPreviewFromDraft(draft: { body: string; buttonText?: string; imageHeader?: boolean }, params: Record<string, string> = WA_EXAMPLE_PARAMS): WaPreview {
  return {
    body: fill(draft.body, params),
    imageHeader: Boolean(draft.imageHeader),
    buttons: [
      ...(draft.buttonText?.trim() ? [{ text: draft.buttonText.trim(), kind: "url" as const }] : []),
      { text: "Não quero receber", kind: "reply" as const },
    ],
  };
}
