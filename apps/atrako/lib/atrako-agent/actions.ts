import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { FormField, FormFieldType, FormStep } from "@atrako/forms";
import { createCaptureForm } from "@/lib/modules/capture-form";
import { newSectionId, type LpSalesPageV1, type LpSection } from "@/lib/criar/lp-schema";
import { publicPath, slugify } from "@/lib/criar/slug";
import type { AtrakoTool, PendingAction } from "./tools";

/**
 * Ações DRAFT do Atrako. A ferramenta só PROPÕE (nada é gravado); o usuário
 * confirma na tela e `executePendingAction` cria o rascunho — nunca publicado.
 */

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");
const strList = (v: unknown, maxItems: number, maxLen: number) =>
  Array.isArray(v)
    ? v.map((x) => str(x, maxLen)).filter(Boolean).slice(0, maxItems)
    : [];

const PRODUCT_TYPES = ["FILE", "SERVICE", "COURSE", "PHYSICAL", "OTHER"] as const;
const FIELD_TYPES: FormFieldType[] = ["text", "email", "phone", "choice", "number", "date", "consent"];

type LpArgs = {
  nome: string;
  objetivo: "leads" | "sales";
  titulo: string;
  subtitulo: string;
  beneficios: string[];
  provas: Array<{ texto: string; autor: string }>;
  faq: Array<{ pergunta: string; resposta: string }>;
  cta: string;
  precoCents: number;
  tipoProduto: (typeof PRODUCT_TYPES)[number];
};

export function normalizeLpArgs(raw: Record<string, unknown>): LpArgs {
  const objetivo = raw.objetivo === "leads" ? "leads" : "sales";
  const titulo = str(raw.titulo, 160) || str(raw.nome, 120) || "Sua oferta";
  const preco = Number(raw.preco_reais);
  const tipo = String(raw.tipo_produto ?? "").toUpperCase();
  return {
    nome: str(raw.nome, 120) || titulo.slice(0, 120),
    objetivo,
    titulo,
    subtitulo: str(raw.subtitulo, 300),
    beneficios: strList(raw.beneficios, 8, 200),
    provas: Array.isArray(raw.provas)
      ? raw.provas
          .map((p) => ({ texto: str((p as Record<string, unknown>)?.texto, 400), autor: str((p as Record<string, unknown>)?.autor, 80) }))
          .filter((p) => p.texto)
          .slice(0, 4)
      : [],
    faq: Array.isArray(raw.faq)
      ? raw.faq
          .map((f) => ({ pergunta: str((f as Record<string, unknown>)?.pergunta, 200), resposta: str((f as Record<string, unknown>)?.resposta, 600) }))
          .filter((f) => f.pergunta && f.resposta)
          .slice(0, 8)
      : [],
    cta: str(raw.cta, 60) || (objetivo === "leads" ? "Quero saber mais" : "Quero comprar"),
    precoCents: Number.isFinite(preco) && preco > 0 ? Math.round(preco * 100) : 0,
    tipoProduto: (PRODUCT_TYPES as readonly string[]).includes(tipo) ? (tipo as LpArgs["tipoProduto"]) : "OTHER",
  };
}

export function lpSalesPage(a: LpArgs): LpSalesPageV1 {
  const sections: LpSection[] = [{ id: newSectionId(), type: "hero", headline: a.titulo, subheadline: a.subtitulo || undefined }];
  if (a.beneficios.length) sections.push({ id: newSectionId(), type: "benefits", items: a.beneficios });
  if (a.provas.length) {
    sections.push({
      id: newSectionId(),
      type: "social_proof",
      quotes: a.provas.map((p) => ({ text: p.texto, author: p.autor || undefined })),
    });
  }
  sections.push(a.objetivo === "leads" ? { id: newSectionId(), type: "form", title: a.cta } : { id: newSectionId(), type: "checkout" });
  if (a.faq.length) sections.push({ id: newSectionId(), type: "faq", items: a.faq.map((f) => ({ q: f.pergunta, a: f.resposta })) });
  sections.push({ id: newSectionId(), type: "cta", label: a.cta });
  return { goal: a.objetivo, version: 1, sections };
}

type FormArgs = { nome: string; titulo: string; campos: FormField[] };

export function normalizeFormArgs(raw: Record<string, unknown>): FormArgs {
  const used = new Set<string>();
  const campos: FormField[] = (Array.isArray(raw.campos) ? raw.campos : [])
    .slice(0, 12)
    .map((c, i) => {
      const o = (c ?? {}) as Record<string, unknown>;
      const type = FIELD_TYPES.includes(o.tipo as FormFieldType) ? (o.tipo as FormFieldType) : "text";
      const label = str(o.rotulo, 160) || `Pergunta ${i + 1}`;
      let id = type === "email" || type === "phone" ? type : slugify(label, `campo_${i + 1}`).replace(/-/g, "_").slice(0, 40);
      while (used.has(id)) id = `${id}_${i + 1}`;
      used.add(id);
      const options = type === "choice" ? strList(o.opcoes, 10, 80) : [];
      return {
        id,
        type: type === "choice" && options.length < 2 ? "text" : type,
        label,
        required: o.obrigatorio !== false,
        ...(type === "choice" && options.length >= 2 ? { options } : {}),
      } satisfies FormField;
    });
  if (!campos.some((c) => c.type === "text" && /nome/i.test(c.label))) {
    campos.unshift({ id: used.has("name") ? "name_1" : "name", type: "text", label: "Nome", required: true });
  }
  if (!campos.some((c) => c.type === "email" || c.type === "phone")) {
    campos.push({ id: "phone", type: "phone", label: "WhatsApp", required: true });
  }
  return {
    nome: str(raw.nome, 120) || "Formulário",
    titulo: str(raw.titulo_etapa, 120) || "Seus dados",
    campos,
  };
}

const nullable = (schema: Record<string, unknown>) => ({
  ...schema,
  type: [schema.type as string, "null"],
});

export const DRAFT_TOOLS: AtrakoTool[] = [
  {
    name: "criar_lp_rascunho",
    step: "Montando a landing page",
    description:
      "Propõe uma landing page (venda com checkout ou captura de leads) em RASCUNHO, com copy pronta baseada no negócio. Nada é publicado: o usuário vê o resumo e confirma na tela.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "objetivo", "titulo", "subtitulo", "beneficios", "provas", "faq", "cta", "preco_reais", "tipo_produto"],
      properties: {
        nome: { type: "string", description: "Nome interno da página/oferta." },
        objetivo: { type: "string", enum: ["sales", "leads"], description: "sales = vender com checkout; leads = capturar contatos." },
        titulo: { type: "string", description: "Headline principal (promessa clara)." },
        subtitulo: nullable({ type: "string", description: "Subheadline." }),
        beneficios: { type: "array", items: { type: "string" }, description: "3 a 6 benefícios curtos." },
        provas: {
          type: "array",
          description: "Depoimentos fornecidos pelo usuário (nunca invente). Vazio se não houver.",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["texto", "autor"],
            properties: { texto: { type: "string" }, autor: nullable({ type: "string" }) },
          },
        },
        faq: {
          type: "array",
          description: "Perguntas frequentes (objeções do público).",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["pergunta", "resposta"],
            properties: { pergunta: { type: "string" }, resposta: { type: "string" } },
          },
        },
        cta: { type: "string", description: "Texto do botão." },
        preco_reais: nullable({ type: "number", description: "Preço em reais (só se objetivo=sales e o usuário informou)." }),
        tipo_produto: nullable({ type: "string", enum: [...PRODUCT_TYPES, null], description: "Tipo do produto vendido." }),
      },
    },
    risk: "DRAFT",
    async run(args) {
      const a = normalizeLpArgs(args);
      const action: PendingAction = {
        tool: "criar_lp_rascunho",
        summary: `Landing page de ${a.objetivo === "leads" ? "captura" : "venda"} "${a.nome}" em rascunho`,
        preview: {
          tipo: a.objetivo === "leads" ? "Landing page de captura" : "Landing page de venda",
          nome: a.nome,
          titulo: a.titulo,
          subtitulo: a.subtitulo || null,
          beneficios: a.beneficios,
          perguntasFrequentes: a.faq.length,
          botao: a.cta,
          preco: a.precoCents ? a.precoCents / 100 : null,
        },
        args: a as unknown as Record<string, unknown>,
      };
      return { data: action.preview, coverage: "available", source: { tool: action.tool, label: "Rascunho de landing page" }, pendingAction: action };
    },
  },
  {
    name: "criar_formulario_rascunho",
    step: "Montando o formulário",
    description:
      "Propõe um formulário de captura/qualificação em RASCUNHO com as perguntas certas para o negócio. Nada é publicado: o usuário confirma na tela.",
    parameters: {
      type: "object",
      additionalProperties: false,
      required: ["nome", "titulo_etapa", "campos"],
      properties: {
        nome: { type: "string", description: "Nome do formulário." },
        titulo_etapa: nullable({ type: "string", description: "Título exibido acima das perguntas." }),
        campos: {
          type: "array",
          description: "Perguntas na ordem (inclua nome e um contato: e-mail ou WhatsApp).",
          items: {
            type: "object",
            additionalProperties: false,
            required: ["rotulo", "tipo", "obrigatorio", "opcoes"],
            properties: {
              rotulo: { type: "string" },
              tipo: { type: "string", enum: FIELD_TYPES },
              obrigatorio: { type: "boolean" },
              opcoes: { type: ["array", "null"], items: { type: "string" }, description: "Só para tipo choice." },
            },
          },
        },
      },
    },
    risk: "DRAFT",
    module: "forms",
    async run(args) {
      const a = normalizeFormArgs(args);
      const action: PendingAction = {
        tool: "criar_formulario_rascunho",
        summary: `Formulário "${a.nome}" com ${a.campos.length} perguntas em rascunho`,
        preview: {
          tipo: "Formulário",
          nome: a.nome,
          perguntas: a.campos.map((c) => `${c.label}${c.required ? "" : " (opcional)"}`),
        },
        args: a as unknown as Record<string, unknown>,
      };
      return { data: action.preview, coverage: "available", source: { tool: action.tool, label: "Rascunho de formulário" }, pendingAction: action };
    },
  },
];

export type ActionResult = {
  kind: "landing_page" | "form";
  id: string;
  name: string;
  status: "DRAFT";
  /** Onde o usuário edita/publica. */
  editPath: string;
  /** URL pública (só funciona depois de publicar). */
  publicPath: string;
};

async function uniqueProductSlug(clienteId: string, base: string) {
  const root = slugify(base, "oferta");
  for (let i = 0; i < 20; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await prisma.commerceProduct.findFirst({ where: { clienteId, slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function executePendingAction(clienteId: string, action: PendingAction): Promise<ActionResult> {
  if (action.tool === "criar_lp_rascunho") {
    const a = normalizeLpArgs(action.args);
    const slug = await uniqueProductSlug(clienteId, a.nome);
    const product = await prisma.commerceProduct.create({
      data: {
        clienteId,
        name: a.nome,
        slug,
        priceCents: a.precoCents,
        description: a.subtitulo || null,
        type: a.tipoProduto,
        status: "DRAFT",
        active: true,
        salesPage: lpSalesPage(a) as unknown as Prisma.InputJsonValue,
      },
      select: { id: true, name: true, slug: true },
    });
    return {
      kind: "landing_page",
      id: product.id,
      name: product.name,
      status: "DRAFT",
      editPath: `/criar/paginas/${encodeURIComponent(product.id)}`,
      publicPath: publicPath("oferta", product.slug),
    };
  }
  if (action.tool === "criar_formulario_rascunho") {
    const a = normalizeFormArgs(action.args);
    const steps: FormStep[] = [{ id: "step_1", title: a.titulo, fields: a.campos }];
    const form = await createCaptureForm({ clienteId, name: a.nome, steps, source: "assistente", status: "DRAFT" });
    return {
      kind: "form",
      id: form.id,
      name: form.name,
      status: "DRAFT",
      editPath: "/forms",
      publicPath: publicPath("formulario", form.slug),
    };
  }
  throw new Error(`Ação desconhecida: ${action.tool}`);
}
