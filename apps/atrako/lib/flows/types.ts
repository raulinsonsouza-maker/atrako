export type EmailBlock =
  | { type: "heading"; text: string }
  | { type: "text"; text: string }
  | { type: "items"; title?: string }
  | { type: "coupon"; text?: string; expires?: string }
  | { type: "recommendations"; title?: string; limit?: number }
  | { type: "button"; label: string; url?: string }
  | { type: "image"; src: string; alt?: string; href?: string }
  | { type: "divider" }
  | { type: "signature" };

export type EmailBlockType = EmailBlock["type"];

export type EmailContent = {
  subject: string;
  preheader?: string;
  blocks: EmailBlock[];
};

export type WhatsAppContent = {
  /** WaTemplateRef.id fixo; senão resolve por `purpose` (template APPROVED mais novo). */
  templateRefId?: string;
  purpose?: string;
  /** Legado / fallback — nome do template na Meta. */
  templateName?: string;
  language?: string;
  /** Mapa variável do template → expressão ({{primeiro_nome}}, {{loja}}, texto fixo…). */
  variables?: Record<string, string>;
  /** Se WA não puder sair (pausado, 131049, sem telefone), envia o e-mail do mesmo passo. */
  fallbackToEmail?: boolean;
  /** E-mail alternativo do mesmo passo (usado quando o WA não pode sair). */
  fallbackEmail?: EmailContent;
  /** Prévia do corpo (estúdio/modelos). */
  previewBody?: string;
};

export type StepContent = EmailContent | WhatsAppContent;

export type RenderItem = {
  title: string;
  quantity?: number;
  unitPriceCents?: number | null;
  imageUrl?: string | null;
  productUrl?: string | null;
};

export type RenderContext = {
  contactName?: string | null;
  storeName: string;
  couponCode?: string | null;
  couponExpires?: string | null;
  items: RenderItem[];
  totalCents?: number | null;
  currency?: string;
  /** Destino principal (checkout, link de pagamento, loja). */
  primaryUrl: string;
  recommendations: RenderItem[];
  unsubscribeUrl: string;
  /** Converte qualquer URL de destino em link rastreado (/r/{token}). */
  trackUrl: (url: string | null | undefined, primary?: boolean) => string;
};

export function isEmailContent(c: unknown): c is EmailContent {
  return Boolean(c && typeof c === "object" && Array.isArray((c as EmailContent).blocks));
}
