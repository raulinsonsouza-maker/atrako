/**
 * Templates WhatsApp por workspace (WaTemplateRef): biblioteca padrão, criação (parameter_format named),
 * sync, versionamento (nunca editar template no ar), linter e montagem de componentes no envio.
 * Graph API v26.0 — doc: developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

import { prisma } from "@/lib/db";
import { waFetch, getWhatsAppCredsOrThrow } from "@/lib/integrations/whatsapp/client";
import { metaGraphUrl } from "@/lib/integrations/meta/graph";
import { resolveWhatsApp } from "@/lib/config/resolveConnection";
import { getServerPublicOrigin } from "@/lib/http/public-origin";
import type { EmailTone } from "@/lib/flows/theme";

export type WaButtonDef =
  | { type: "URL"; text: string }
  | { type: "COPY_CODE" }
  | { type: "QUICK_REPLY"; text: string; payload: string };

export type WaTemplateDef = {
  purpose: string;
  category: "MARKETING" | "UTILITY";
  /** Header de imagem do produto (exemplo via Resumable Upload) */
  imageHeader?: boolean;
  /** Oferta com prazo (contagem regressiva) — só MARKETING, sem footer */
  limitedTimeOffer?: string;
  body: Record<EmailTone, string>;
  footer?: string;
  buttons: WaButtonDef[];
  /** Carrossel: N cards com imagem + botão URL */
  carouselCards?: number;
};

const OPTOUT: WaButtonDef = { type: "QUICK_REPLY", text: "Não quero receber", payload: "atk_optout" };

export const PARAM_EXAMPLES: Record<string, string> = {
  first_name: "Ana",
  product_name: "Tênis Runner",
  store_name: "Loja Exemplo",
  coupon_code: "VOLTA10",
  order_ref: "#1234",
  order_total: "R$ 189,90",
  expires: "até domingo",
};

/** Biblioteca padrão — corpo nunca começa/termina com variável; UTILITY sem promoção. */
export const WA_TEMPLATE_LIBRARY: WaTemplateDef[] = [
  {
    purpose: "cart_1",
    category: "MARKETING",
    imageHeader: true,
    body: {
      proximo:
        "Oi {{first_name}}! Você deixou {{product_name}} no carrinho da {{store_name}}. Separamos tudo pra você, é só finalizar quando quiser.",
      neutro:
        "Olá {{first_name}}, seu carrinho na {{store_name}} ainda está salvo com {{product_name}}. Finalize a compra pelo botão abaixo.",
      formal:
        "Olá {{first_name}}. Os itens do seu carrinho na {{store_name}}, incluindo {{product_name}}, continuam reservados. Conclua a compra pelo link abaixo.",
    },
    buttons: [{ type: "URL", text: "Finalizar compra" }, OPTOUT],
  },
  {
    purpose: "cart_coupon",
    category: "MARKETING",
    imageHeader: true,
    body: {
      proximo:
        "{{first_name}}, liberamos um presente pra você fechar o pedido: use o cupom {{coupon_code}} na {{store_name}}. Válido {{expires}}.",
      neutro:
        "Olá {{first_name}}, para concluir sua compra na {{store_name}} use o cupom {{coupon_code}}. Válido {{expires}}.",
      formal:
        "Olá {{first_name}}. Disponibilizamos o cupom {{coupon_code}} para concluir sua compra na {{store_name}}, válido {{expires}}.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Usar cupom" }, OPTOUT],
  },
  {
    purpose: "cart_lto",
    category: "MARKETING",
    imageHeader: true,
    limitedTimeOffer: "Cupom expirando",
    body: {
      proximo:
        "Última chance, {{first_name}}! O cupom {{coupon_code}} da {{store_name}} acaba logo. Seu carrinho continua salvo.",
      neutro:
        "Olá {{first_name}}, o cupom {{coupon_code}} da {{store_name}} está acabando. Seu carrinho continua salvo.",
      formal:
        "Olá {{first_name}}. O cupom {{coupon_code}} da {{store_name}} expira em breve e seu carrinho permanece salvo.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Finalizar compra" }],
  },
  {
    purpose: "order_unpaid",
    category: "UTILITY",
    body: {
      proximo:
        "Oi {{first_name}}, seu pedido {{order_ref}} na {{store_name}} está aguardando o pagamento de {{order_total}}. Para concluir, acesse o link abaixo.",
      neutro:
        "Olá {{first_name}}, o pedido {{order_ref}} na {{store_name}} aguarda o pagamento de {{order_total}}. Acesse o link abaixo para pagar.",
      formal:
        "Olá {{first_name}}. O pedido {{order_ref}} na {{store_name}} aguarda o pagamento de {{order_total}}. Utilize o link abaixo para concluir.",
    },
    buttons: [{ type: "URL", text: "Pagar pedido" }],
  },
  {
    purpose: "birthday",
    category: "MARKETING",
    body: {
      proximo:
        "Feliz aniversário, {{first_name}}! A {{store_name}} preparou um presente: o cupom {{coupon_code}}, válido {{expires}}.",
      neutro:
        "Feliz aniversário, {{first_name}}! Use o cupom {{coupon_code}} na {{store_name}}, válido {{expires}}.",
      formal:
        "Feliz aniversário, {{first_name}}. A {{store_name}} oferece o cupom {{coupon_code}}, válido {{expires}}.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Ver presentes" }, OPTOUT],
  },
  {
    // A resposta (DD/MM) é lida em handleFlowInbound e vira ContactImportantDate
    purpose: "birthday_ask",
    category: "MARKETING",
    body: {
      proximo:
        "Oi {{first_name}}! Aqui é da {{store_name}}. Queremos te mandar um presente no seu aniversário. Responda esta mensagem com o dia e o mês (ex.: 15/08).",
      neutro:
        "Olá {{first_name}}, a {{store_name}} quer te enviar um presente de aniversário. Responda com o dia e o mês do seu aniversário (ex.: 15/08).",
      formal:
        "Olá {{first_name}}. A {{store_name}} gostaria de presenteá-lo(a) no seu aniversário. Por gentileza, responda com o dia e o mês (ex.: 15/08).",
    },
    buttons: [OPTOUT],
  },
  {
    purpose: "repurchase",
    category: "MARKETING",
    imageHeader: true,
    body: {
      proximo:
        "Oi {{first_name}}! Já está na hora de repor {{product_name}}? Na {{store_name}} é só um clique pra comprar de novo.",
      neutro:
        "Olá {{first_name}}, está na hora de repor {{product_name}}. Compre de novo na {{store_name}} pelo botão abaixo.",
      formal:
        "Olá {{first_name}}. Lembramos que pode ser o momento de repor {{product_name}}. Compre novamente na {{store_name}}.",
    },
    buttons: [{ type: "URL", text: "Comprar de novo" }, OPTOUT],
  },
  {
    purpose: "second_purchase",
    category: "MARKETING",
    body: {
      proximo:
        "{{first_name}}, que bom ter você com a gente! Pra sua próxima compra na {{store_name}}, use o cupom {{coupon_code}}. Válido {{expires}}.",
      neutro:
        "Olá {{first_name}}, na sua próxima compra na {{store_name}} use o cupom {{coupon_code}}, válido {{expires}}.",
      formal:
        "Olá {{first_name}}. Para sua próxima compra na {{store_name}}, oferecemos o cupom {{coupon_code}}, válido {{expires}}.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Ver novidades" }, OPTOUT],
  },
  {
    purpose: "winback",
    category: "MARKETING",
    body: {
      proximo:
        "Sentimos sua falta, {{first_name}}! Volte pra {{store_name}} com o cupom {{coupon_code}}, válido {{expires}}.",
      neutro:
        "Olá {{first_name}}, faz tempo que você não passa na {{store_name}}. Use o cupom {{coupon_code}}, válido {{expires}}.",
      formal:
        "Olá {{first_name}}. Gostaríamos de recebê-lo novamente na {{store_name}} com o cupom {{coupon_code}}, válido {{expires}}.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Voltar à loja" }, OPTOUT],
  },
  {
    purpose: "lost_nurture",
    category: "MARKETING",
    body: {
      proximo:
        "Oi {{first_name}}, separamos os mais vendidos da {{store_name}} desta semana. Dá uma olhada, acho que você vai gostar.",
      neutro:
        "Olá {{first_name}}, confira os mais vendidos da {{store_name}} desta semana.",
      formal:
        "Olá {{first_name}}. Apresentamos os produtos mais procurados da {{store_name}} nesta semana.",
    },
    buttons: [{ type: "URL", text: "Ver produtos" }, OPTOUT],
  },
  {
    purpose: "welcome",
    category: "MARKETING",
    body: {
      proximo:
        "Bem-vindo(a), {{first_name}}! Pra sua primeira compra na {{store_name}}, use o cupom {{coupon_code}}. Válido {{expires}}.",
      neutro:
        "Olá {{first_name}}, boas-vindas à {{store_name}}. Na primeira compra use o cupom {{coupon_code}}, válido {{expires}}.",
      formal:
        "Olá {{first_name}}. Seja bem-vindo(a) à {{store_name}}. Na primeira compra, utilize o cupom {{coupon_code}}, válido {{expires}}.",
    },
    buttons: [{ type: "COPY_CODE" }, { type: "URL", text: "Conhecer a loja" }, OPTOUT],
  },
  ...[2, 3, 4].map(
    (n): WaTemplateDef => ({
      purpose: `carousel_${n}`,
      category: "MARKETING",
      carouselCards: n,
      body: {
        proximo: "Oi {{first_name}}, separamos estes produtos da {{store_name}} pra você.",
        neutro: "Olá {{first_name}}, confira estes produtos da {{store_name}}.",
        formal: "Olá {{first_name}}. Selecionamos estes produtos da {{store_name}}.",
      },
      buttons: [],
    }),
  ),
];

export function templateName(purpose: string, tone: EmailTone, version: number) {
  return `atk_${purpose}_${tone}_v${version}`.toLowerCase().replace(/[^a-z0-9_]/g, "_");
}

export function bodyParams(body: string): string[] {
  return Array.from(new Set(Array.from(body.matchAll(/\{\{\s*([a-z_]+)\s*\}\}/g)).map((m) => m[1])));
}

// --------------------------------------------------------------------------- linter

export type LintResult = { errors: string[]; warnings: string[] };

const PROMO_RE = /cupom|desconto|promo|oferta|aproveite|gr[aá]tis|frete gr|% ?off|liquida|black friday/i;
const SHORTENER_RE = /bit\.ly|tinyurl|goo\.gl|t\.co\/|cutt\.ly|is\.gd/i;

export function lintTemplate(input: {
  category: string;
  body: string;
  buttons: Array<{ type: string; text?: string; url?: string }>;
  footer?: string;
  limitedTimeOffer?: boolean;
}): LintResult {
  const errors: string[] = [];
  const warnings: string[] = [];
  const body = input.body.trim();
  if (!body) errors.push("Corpo vazio.");
  if (body.length > 1024) errors.push(`Corpo com ${body.length} caracteres (máximo 1.024).`);
  if (/^\{\{/.test(body)) errors.push("O texto não pode começar com uma variável.");
  if (/\}\}[.!?…]?$/.test(body)) errors.push("O texto não pode terminar com uma variável.");
  if (/\}\}\s*\{\{/.test(body)) errors.push("Variáveis não podem ficar coladas uma na outra.");
  if (SHORTENER_RE.test(body)) errors.push("Encurtadores de URL não são aceitos pela Meta.");
  if ((input.footer ?? "").length > 60) errors.push("Rodapé com mais de 60 caracteres.");
  const urls = input.buttons.filter((b) => b.type === "URL");
  if (urls.length > 2) errors.push("Máximo de 2 botões de URL.");
  if (input.buttons.filter((b) => b.type === "COPY_CODE").length > 1) {
    errors.push("Apenas 1 botão de copiar código por template.");
  }
  for (const b of input.buttons) {
    if (b.text && b.text.length > 25) errors.push(`Botão "${b.text}" com mais de 25 caracteres.`);
  }
  if (input.buttons.length > 10) errors.push("Máximo de 10 botões.");
  if (input.buttons.length > 3) warnings.push("Com 4 ou mais botões a mensagem não abre no WhatsApp desktop.");
  const hasQuick = input.buttons.some((b) => b.type === "QUICK_REPLY");
  const hasOther = input.buttons.some((b) => b.type !== "QUICK_REPLY");
  if (hasQuick && hasOther) {
    warnings.push("Resposta rápida junto de outro tipo de botão não aparece no WhatsApp desktop.");
  }
  if (input.buttons.some((b) => b.type === "COPY_CODE")) {
    warnings.push("O botão de copiar código não aparece no WhatsApp Web — mantenha o código no corpo.");
  }
  if (input.limitedTimeOffer) {
    if (input.category !== "MARKETING") errors.push("Oferta com prazo só é permitida em MARKETING.");
    if (input.footer) errors.push("Oferta com prazo não pode ter rodapé.");
    warnings.push("Oferta com prazo não aparece no WhatsApp Web/desktop.");
  }
  if (input.category === "UTILITY" && PROMO_RE.test(body)) {
    errors.push(
      "Texto promocional em UTILITY: a Meta recategoriza como MARKETING e pode punir a conta. Remova cupom/oferta ou mude a categoria.",
    );
  }
  return { errors, warnings };
}

// --------------------------------------------------------------------------- Meta API

type MetaTemplate = {
  id?: string;
  name?: string;
  language?: string;
  status?: string;
  category?: string;
  quality_score?: { score?: string } | string;
  components?: unknown;
  parameter_format?: string;
  rejected_reason?: string;
};

function purposeFromName(name: string): string | null {
  const m = name.match(/^atk_(.+?)_(proximo|neutro|formal)_v\d+$/);
  return m ? m[1] : null;
}

function versionFromName(name: string): number {
  const m = name.match(/_v(\d+)$/);
  return m ? Number(m[1]) : 1;
}

/** GET message_templates → WaTemplateRef (status, qualidade, categoria, componentes). */
export async function syncWaTemplates(workspaceId: string) {
  const creds = await getWhatsAppCredsOrThrow(workspaceId);
  if (!creds.wabaId) return { synced: 0 };
  let path: string | null =
    `/${creds.wabaId}/message_templates?limit=100&fields=id,name,language,status,category,quality_score,components,parameter_format,rejected_reason`;
  let synced = 0;
  for (let page = 0; path && page < 20; page++) {
    const res = await waFetch(workspaceId, path);
    const data = (await res.json()) as {
      data?: MetaTemplate[];
      paging?: { next?: string; cursors?: { after?: string } };
      error?: { message?: string };
    };
    if (!res.ok) throw new Error(data.error?.message || `Falha ao sincronizar templates (${res.status})`);
    for (const t of data.data ?? []) {
      if (!t.name || !t.language) continue;
      const quality = typeof t.quality_score === "string" ? t.quality_score : t.quality_score?.score;
      const existing = await prisma.waTemplateRef.findUnique({
        where: { clienteId_name_language: { clienteId: workspaceId, name: t.name, language: t.language } },
      });
      const data2 = {
        metaTemplateId: t.id ?? existing?.metaTemplateId ?? null,
        status: t.status || "UNKNOWN",
        category: t.category ?? null,
        qualityScore: quality ?? null,
        components: (t.components ?? undefined) as object | undefined,
        parameterFormat: t.parameter_format?.toLowerCase() ?? existing?.parameterFormat ?? null,
        rejectedReason: t.rejected_reason && t.rejected_reason !== "NONE" ? t.rejected_reason : null,
        lastSyncedAt: new Date(),
      };
      if (existing) {
        await prisma.waTemplateRef.update({ where: { id: existing.id }, data: data2 });
      } else {
        await prisma.waTemplateRef.create({
          data: {
            clienteId: workspaceId,
            name: t.name,
            language: t.language,
            purpose: purposeFromName(t.name),
            version: versionFromName(t.name),
            ...data2,
          },
        });
      }
      synced++;
    }
    const after = data.paging?.cursors?.after;
    path = data.paging?.next && after
      ? `/${creds.wabaId}/message_templates?limit=100&after=${after}&fields=id,name,language,status,category,quality_score,components,parameter_format,rejected_reason`
      : null;
  }
  return { synced };
}

/** Resumable Upload API → header_handle (exemplo de imagem do header). */
export async function uploadHeaderHandle(workspaceId: string, imageUrl: string): Promise<string | null> {
  try {
    const { resolvePlatformApp } = await import("@/lib/config/platformApps");
    const app = await resolvePlatformApp("META");
    const appId = typeof app?.credentials.clientId === "string" ? app.credentials.clientId : null;
    const wa = await resolveWhatsApp(workspaceId);
    if (!appId || !wa) return null;
    const img = await fetch(imageUrl, { cache: "no-store" });
    if (!img.ok) return null;
    const type = img.headers.get("content-type")?.split(";")[0] || "image/jpeg";
    if (!/image\/(jpeg|png)/.test(type)) return null;
    const bytes = Buffer.from(await img.arrayBuffer());
    if (bytes.length > 5 * 1024 * 1024) return null;
    const session = await fetch(
      metaGraphUrl(`/${appId}/uploads?file_length=${bytes.length}&file_type=${encodeURIComponent(type)}`),
      { method: "POST", headers: { Authorization: `Bearer ${wa.accessToken}` }, cache: "no-store" },
    );
    const s = (await session.json()) as { id?: string };
    if (!session.ok || !s.id) return null;
    const up = await fetch(metaGraphUrl(`/${s.id}`), {
      method: "POST",
      headers: { Authorization: `OAuth ${wa.accessToken}`, file_offset: "0" },
      body: bytes,
      cache: "no-store",
    });
    const u = (await up.json()) as { h?: string };
    return up.ok && u.h ? u.h : null;
  } catch (err) {
    console.warn("[wa-templates] header upload", err instanceof Error ? err.message : err);
    return null;
  }
}

function exampleUrl(origin: string) {
  return `${origin}/r/exemplo123`;
}

/** Monta o payload de criação (parameter_format named + exemplos). */
export function buildCreatePayload(
  def: WaTemplateDef,
  tone: EmailTone,
  version: number,
  opts: { origin: string; headerHandle: string | null; storeName: string },
) {
  const body = def.body[tone];
  const params = bodyParams(body);
  const components: Array<Record<string, unknown>> = [];
  const urlButton = (text: string) => ({
    type: "URL",
    text,
    url: `${opts.origin}/r/{{1}}`,
    example: [exampleUrl(opts.origin)],
  });

  if (def.carouselCards) {
    components.push({
      type: "BODY",
      text: body,
      example: {
        body_text_named_params: params.map((p) => ({
          param_name: p,
          example: p === "store_name" ? opts.storeName : PARAM_EXAMPLES[p] ?? "exemplo",
        })),
      },
    });
    components.push({
      type: "CAROUSEL",
      cards: Array.from({ length: def.carouselCards }, () => ({
        components: [
          { type: "HEADER", format: "IMAGE", example: { header_handle: [opts.headerHandle ?? ""] } },
          { type: "BUTTONS", buttons: [urlButton("Ver produto")] },
        ],
      })),
    });
  } else {
    if (def.imageHeader && opts.headerHandle) {
      components.push({ type: "HEADER", format: "IMAGE", example: { header_handle: [opts.headerHandle] } });
    }
    if (def.limitedTimeOffer) {
      components.push({
        type: "LIMITED_TIME_OFFER",
        limited_time_offer: { text: def.limitedTimeOffer, has_expiration: true },
      });
    }
    components.push({
      type: "BODY",
      text: body,
      example: {
        body_text_named_params: params.map((p) => ({
          param_name: p,
          example: p === "store_name" ? opts.storeName : PARAM_EXAMPLES[p] ?? "exemplo",
        })),
      },
    });
    if (def.footer && !def.limitedTimeOffer) components.push({ type: "FOOTER", text: def.footer });
    if (def.buttons.length) {
      components.push({
        type: "BUTTONS",
        buttons: def.buttons.map((b) =>
          b.type === "URL"
            ? urlButton(b.text)
            : b.type === "COPY_CODE"
              ? { type: "COPY_CODE", example: PARAM_EXAMPLES.coupon_code }
              : { type: "QUICK_REPLY", text: b.text },
        ),
      });
    }
  }

  return {
    name: templateName(def.purpose, tone, version),
    language: "pt_BR",
    category: def.category,
    parameter_format: "named",
    components,
  };
}

/** Cria na Meta e registra WaTemplateRef PENDING. */
export async function createWaTemplateFromDef(
  workspaceId: string,
  def: WaTemplateDef,
  tone: EmailTone,
  version = 1,
) {
  const creds = await getWhatsAppCredsOrThrow(workspaceId);
  if (!creds.wabaId) throw new Error("WABA não identificada na conexão do WhatsApp");
  const cliente = await prisma.cliente.findUnique({
    where: { id: workspaceId },
    select: { nome: true, logoUrl: true },
  });
  const needsImage = def.imageHeader || def.carouselCards;
  const headerHandle = needsImage && cliente?.logoUrl
    ? await uploadHeaderHandle(workspaceId, cliente.logoUrl)
    : null;
  if (def.carouselCards && !headerHandle) {
    throw new Error("Carrossel precisa de imagem de exemplo (logo da loja em Config → Empresa).");
  }
  const payload = buildCreatePayload(def, tone, version, {
    origin: getServerPublicOrigin(),
    headerHandle,
    storeName: cliente?.nome ?? "Loja",
  });
  const res = await waFetch(workspaceId, `/${creds.wabaId}/message_templates`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  const data = (await res.json()) as {
    id?: string;
    status?: string;
    category?: string;
    error?: { message?: string; error_user_msg?: string };
  };
  if (!res.ok) {
    throw new Error(data.error?.error_user_msg || data.error?.message || `Falha ao criar template (${res.status})`);
  }
  return prisma.waTemplateRef.upsert({
    where: { clienteId_name_language: { clienteId: workspaceId, name: payload.name, language: "pt_BR" } },
    create: {
      clienteId: workspaceId,
      name: payload.name,
      language: "pt_BR",
      status: data.status || "PENDING",
      category: data.category || def.category,
      requestedCategory: def.category,
      metaTemplateId: data.id ?? null,
      components: payload.components as object,
      parameterFormat: "named",
      purpose: def.purpose,
      version,
    },
    update: {
      status: data.status || "PENDING",
      metaTemplateId: data.id ?? null,
      components: payload.components as object,
    },
  });
}

/** Ao conectar o WA: cria os templates padrão no tom da loja (até 100 criações/h — aqui ~13). */
export async function ensureDefaultWaTemplates(workspaceId: string, tone?: EmailTone) {
  const wa = await resolveWhatsApp(workspaceId);
  if (!wa?.wabaId) return { created: 0, skipped: true };
  const theme = await prisma.emailTheme.findUnique({ where: { clienteId: workspaceId } });
  const t: EmailTone =
    tone ??
    ((theme?.published as { tone?: EmailTone } | null)?.tone || "proximo");
  await syncWaTemplates(workspaceId).catch(() => null);
  const existing = await prisma.waTemplateRef.findMany({
    where: { clienteId: workspaceId, purpose: { not: null }, status: { notIn: ["DELETED", "PENDING_DELETION"] } },
    select: { purpose: true },
  });
  const have = new Set(existing.map((e) => e.purpose));
  let created = 0;
  const errors: string[] = [];
  for (const def of WA_TEMPLATE_LIBRARY) {
    if (have.has(def.purpose)) continue;
    try {
      await createWaTemplateFromDef(workspaceId, def, t);
      created++;
    } catch (err) {
      errors.push(`${def.purpose}: ${err instanceof Error ? err.message : err}`);
    }
  }
  return { created, errors };
}

/** Nova versão (corrigir rejeição / mudar texto) — a antiga segue no ar até a nova ser aprovada. */
export async function createTemplateVersion(
  workspaceId: string,
  refId: string,
  changes: { body?: string; category?: "MARKETING" | "UTILITY" },
) {
  const ref = await prisma.waTemplateRef.findFirst({ where: { id: refId, clienteId: workspaceId } });
  if (!ref?.purpose) throw new Error("Template sem finalidade (purpose) — crie pelo estúdio");
  const base = WA_TEMPLATE_LIBRARY.find((d) => d.purpose === ref.purpose);
  if (!base) throw new Error("Finalidade sem modelo de biblioteca");
  const tone = (ref.name.match(/_(proximo|neutro|formal)_v\d+$/)?.[1] ?? "proximo") as EmailTone;
  const def: WaTemplateDef = {
    ...base,
    category: changes.category ?? base.category,
    body: changes.body ? { ...base.body, [tone]: changes.body } : base.body,
  };
  const lint = lintTemplate({
    category: def.category,
    body: def.body[tone],
    buttons: def.buttons.map((b) => ({ type: b.type, text: "text" in b ? b.text : undefined })),
    footer: def.footer,
    limitedTimeOffer: Boolean(def.limitedTimeOffer),
  });
  if (lint.errors.length) throw new Error(lint.errors.join(" "));
  const maxVersion = await prisma.waTemplateRef.aggregate({
    where: { clienteId: workspaceId, purpose: ref.purpose },
    _max: { version: true },
  });
  const created = await createWaTemplateFromDef(workspaceId, def, tone, (maxVersion._max.version ?? 1) + 1);
  return created;
}

/** Template próprio (campanha / estúdio): sempre MARKETING ou UTILITY com opt-out, versão nova a cada envio. */
export async function createCustomTemplate(
  workspaceId: string,
  input: {
    purpose: string;
    category: "MARKETING" | "UTILITY";
    body: string;
    buttonText?: string | null;
    imageHeader?: boolean;
    copyCode?: boolean;
  },
) {
  const purpose = input.purpose.toLowerCase().replace(/[^a-z0-9_]/g, "_").slice(0, 40);
  const buttons: WaButtonDef[] = [];
  if (input.buttonText?.trim()) buttons.push({ type: "URL", text: input.buttonText.trim().slice(0, 25) });
  if (input.copyCode) buttons.push({ type: "COPY_CODE" });
  if (input.category === "MARKETING") buttons.push(OPTOUT);
  const lint = lintTemplate({
    category: input.category,
    body: input.body,
    buttons: buttons.map((b) => ({ type: b.type, text: "text" in b ? b.text : undefined })),
  });
  if (lint.errors.length) throw new Error(lint.errors.join(" "));
  const theme = await prisma.emailTheme.findUnique({ where: { clienteId: workspaceId } });
  const tone: EmailTone = (theme?.published as { tone?: EmailTone } | null)?.tone || "proximo";
  const def: WaTemplateDef = {
    purpose,
    category: input.category,
    imageHeader: input.imageHeader,
    body: { proximo: input.body, neutro: input.body, formal: input.body },
    buttons,
  };
  const maxVersion = await prisma.waTemplateRef.aggregate({
    where: { clienteId: workspaceId, purpose },
    _max: { version: true },
  });
  return createWaTemplateFromDef(workspaceId, def, tone, (maxVersion._max.version ?? 0) + 1);
}

/** Template APPROVED mais novo da finalidade. */
export async function resolveTemplateForPurpose(workspaceId: string, purpose: string) {
  return prisma.waTemplateRef.findFirst({
    where: { clienteId: workspaceId, purpose, status: "APPROVED" },
    orderBy: { version: "desc" },
  });
}

/** Ao aprovar nova versão: marca as anteriores como substituídas. */
export async function promoteApprovedVersion(templateRefId: string) {
  const ref = await prisma.waTemplateRef.findUnique({ where: { id: templateRefId } });
  if (!ref?.purpose || ref.status !== "APPROVED") return;
  await prisma.waTemplateRef.updateMany({
    where: {
      clienteId: ref.clienteId,
      purpose: ref.purpose,
      version: { lt: ref.version },
      replacedById: null,
    },
    data: { replacedById: ref.id },
  });
}

// --------------------------------------------------------------------------- envio

type TemplateComponent = {
  type?: string;
  format?: string;
  text?: string;
  buttons?: Array<{ type?: string; text?: string; url?: string }>;
  cards?: Array<{ components?: TemplateComponent[] }>;
};

export type TemplateSendValues = {
  params: Record<string, string>;
  headerImageUrl?: string | null;
  /** Sufixo do botão URL (token do /r) */
  urlSuffix: string;
  couponCode?: string | null;
  ltoExpiresAt?: Date | null;
  cards?: Array<{ imageUrl: string; urlSuffix: string }>;
};

/** Converte a definição do template (components da Meta) nos parâmetros de envio. */
export function buildSendComponents(
  templateComponents: unknown,
  parameterFormat: string | null,
  values: TemplateSendValues,
): { components: Array<Record<string, unknown>>; missing: string[] } {
  const comps = (Array.isArray(templateComponents) ? templateComponents : []) as TemplateComponent[];
  const out: Array<Record<string, unknown>> = [];
  const missing: string[] = [];
  const named = (parameterFormat ?? "").toLowerCase() === "named";

  const bodyComponent = (text: string | undefined) => {
    const params = bodyParams(text ?? "");
    const positional = Array.from((text ?? "").matchAll(/\{\{(\d+)\}\}/g)).map((m) => m[1]);
    if (named && params.length) {
      return {
        type: "body",
        parameters: params.map((p) => {
          const v = values.params[p];
          if (!v) missing.push(p);
          return { type: "text", parameter_name: p, text: v || "-" };
        }),
      };
    }
    if (positional.length) {
      const ordered = Object.values(values.params);
      return {
        type: "body",
        parameters: positional.map((_, i) => ({ type: "text", text: ordered[i] || "-" })),
      };
    }
    return null;
  };

  for (const c of comps) {
    const type = (c.type ?? "").toUpperCase();
    if (type === "HEADER" && (c.format ?? "").toUpperCase() === "IMAGE") {
      if (!values.headerImageUrl) missing.push("header_image");
      out.push({
        type: "header",
        parameters: [{ type: "image", image: { link: values.headerImageUrl ?? "" } }],
      });
    } else if (type === "LIMITED_TIME_OFFER") {
      const exp = values.ltoExpiresAt ?? new Date(Date.now() + 24 * 3_600_000);
      out.push({
        type: "limited_time_offer",
        parameters: [{ type: "limited_time_offer", limited_time_offer: { expiration_time_ms: exp.getTime() } }],
      });
    } else if (type === "BODY") {
      const b = bodyComponent(c.text);
      if (b) out.push(b);
    } else if (type === "BUTTONS") {
      (c.buttons ?? []).forEach((btn, index) => {
        const bt = (btn.type ?? "").toUpperCase();
        if (bt === "URL" && btn.url?.includes("{{")) {
          out.push({
            type: "button",
            sub_type: "url",
            index: String(index),
            parameters: [{ type: "text", text: values.urlSuffix }],
          });
        } else if (bt === "COPY_CODE") {
          if (!values.couponCode) missing.push("coupon_code");
          out.push({
            type: "button",
            sub_type: "copy_code",
            index: String(index),
            parameters: [{ type: "coupon_code", coupon_code: values.couponCode ?? "" }],
          });
        } else if (bt === "QUICK_REPLY") {
          const payload = /n[aã]o quero|parar|sair/i.test(btn.text ?? "") ? "atk_optout" : "atk_help";
          out.push({
            type: "button",
            sub_type: "quick_reply",
            index: String(index),
            parameters: [{ type: "payload", payload }],
          });
        }
      });
    } else if (type === "CAROUSEL") {
      const cards = c.cards ?? [];
      if ((values.cards?.length ?? 0) < cards.length) missing.push("carousel_cards");
      out.push({
        type: "carousel",
        cards: cards.map((card, i) => {
          const v = values.cards?.[i];
          const inner: Array<Record<string, unknown>> = [];
          for (const cc of card.components ?? []) {
            const t = (cc.type ?? "").toUpperCase();
            if (t === "HEADER") {
              inner.push({ type: "header", parameters: [{ type: "image", image: { link: v?.imageUrl ?? "" } }] });
            } else if (t === "BUTTONS") {
              (cc.buttons ?? []).forEach((btn, bi) => {
                if ((btn.type ?? "").toUpperCase() === "URL" && btn.url?.includes("{{")) {
                  inner.push({
                    type: "button",
                    sub_type: "url",
                    index: String(bi),
                    parameters: [{ type: "text", text: v?.urlSuffix ?? values.urlSuffix }],
                  });
                }
              });
            }
          }
          return { card_index: i, components: inner };
        }),
      });
    }
  }
  return { components: out, missing };
}

/** Texto de prévia com os parâmetros aplicados. */
export function renderTemplatePreview(templateComponents: unknown, params: Record<string, string>) {
  const comps = (Array.isArray(templateComponents) ? templateComponents : []) as TemplateComponent[];
  const body = comps.find((c) => (c.type ?? "").toUpperCase() === "BODY")?.text ?? "";
  return body.replace(/\{\{\s*([a-z_0-9]+)\s*\}\}/gi, (_, k: string) => params[k] ?? `{{${k}}}`);
}
