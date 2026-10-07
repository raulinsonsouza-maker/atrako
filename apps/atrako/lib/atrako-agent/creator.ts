import "server-only";
import { prisma } from "@/lib/db";
import type { Prisma } from "@/lib/generated/prisma";
import type { FormStep } from "@atrako/forms";
import {
  createCaptureForm,
  getCaptureFormById,
  isCaptureFormSlugTaken,
  updateCaptureFormStatus,
  type CaptureFormRow,
} from "@/lib/modules/capture-form";
import { getWorkspaceConfig, resolveBrand } from "@/lib/config/getWorkspaceConfig";
import { getMpPublicKey } from "@/lib/integrations/mercadopago/payments";
import { publicPath, slugify } from "@/lib/criar/slug";
import { buildSalesPageV3, htmlText, isLpSalesPageV3, validateLpV3, type LpSalesPageV3 } from "@/lib/criar/lp-html";
import { createPreviewToken, formPreviewPath, lpPreviewPath } from "@/lib/criar/preview-token";
import { flattenFields, sampleAnswers, validateFormAnswers } from "@/lib/criar/form-test";
import { normalizeFormArgs } from "./actions";
import { artifactId, type Artifact, type FormPreviewArtifact, type LpPreviewArtifact, type TestStep } from "./artifacts";
import { DesignError, runDesigner, type DesignBrief, type DesignOutput } from "./designer";
import { nullableString, objectSchema, type AtrakoTool, type ToolResult, type ToolRuntime } from "./tools";

/**
 * Ferramentas de criação do Atrako: LP em HTML (v3) com formulário/checkout nativos,
 * formulário, edição, teste e publicação. Tudo nasce em rascunho; publicar é uma
 * ferramenta separada, usada só quando o usuário pede.
 */

const FIELD_TYPES = ["text", "email", "phone", "choice", "number", "date", "consent"] as const;
const LP_EDIT_PATH = (id: string) => `/criar/paginas/${encodeURIComponent(id)}`;
const FORM_EDIT_PATH = "/forms";

const str = (v: unknown, max: number) => (typeof v === "string" ? v.trim().slice(0, max) : "");

const fieldItems = {
  type: "object",
  additionalProperties: false,
  required: ["rotulo", "tipo", "obrigatorio", "opcoes"],
  properties: {
    rotulo: { type: "string" },
    tipo: { type: "string", enum: [...FIELD_TYPES] },
    obrigatorio: { type: "boolean" },
    opcoes: { type: ["array", "null"], items: { type: "string" }, description: "Só para tipo choice." },
  },
};

// ── slugs globais (/p e /f não filtram por workspace) ──

export async function uniqueGlobalProductSlug(base: string): Promise<string> {
  const root = slugify(base, "pagina").slice(0, 60);
  for (let i = 0; i < 25; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    const taken = await prisma.commerceProduct.findFirst({ where: { slug }, select: { id: true } });
    if (!taken) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

export async function uniqueGlobalFormSlug(base: string): Promise<string> {
  const root = slugify(base, "formulario").slice(0, 60);
  for (let i = 0; i < 25; i++) {
    const slug = i === 0 ? root : `${root}-${i + 1}`;
    if (!(await isCaptureFormSlugTaken(slug))) return slug;
  }
  return `${root}-${Date.now().toString(36)}`;
}

// ── artefatos ──

type ProductRow = { id: string; clienteId: string; name: string; slug: string; status: string; salesPage: unknown };

export function lpPreviewArtifact(p: ProductRow): LpPreviewArtifact {
  const page = isLpSalesPageV3(p.salesPage) ? p.salesPage : null;
  const token = createPreviewToken({ kind: "lp", id: p.id, clienteId: p.clienteId });
  return {
    kind: "lp_preview",
    id: artifactId("lp"),
    productId: p.id,
    name: p.name,
    status: p.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    previewUrl: lpPreviewPath(p.slug, token),
    publicUrl: publicPath("oferta", p.slug),
    editPath: LP_EDIT_PATH(p.id),
    formId: page?.formId ?? null,
    hasCheckout: page?.goal === "sales",
  };
}

export function formPreviewArtifact(f: CaptureFormRow): FormPreviewArtifact {
  const token = createPreviewToken({ kind: "form", id: f.id, clienteId: f.clienteId });
  return {
    kind: "form_preview",
    id: artifactId("form"),
    formId: f.id,
    name: f.name,
    status: f.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
    previewUrl: formPreviewPath(f.slug, token),
    publicUrl: publicPath("formulario", f.slug),
    fields: flattenFields(f.steps).map((x) => ({ label: x.label, type: x.type, required: Boolean(x.required) })),
  };
}

// ── publicação ──

export type PublishResult = {
  kind: "landing_page" | "form";
  id: string;
  name: string;
  status: "PUBLISHED";
  publicPath: string;
  warnings: string[];
};

export async function publishResource(clienteId: string, kind: "landing_page" | "form", id: string): Promise<PublishResult> {
  if (kind === "form") {
    const form = await updateCaptureFormStatus(clienteId, id, "PUBLISHED");
    if (!form) throw new Error("Formulário não encontrado neste workspace.");
    return { kind, id: form.id, name: form.name, status: "PUBLISHED", publicPath: publicPath("formulario", form.slug), warnings: [] };
  }
  const product = await prisma.commerceProduct.findFirst({ where: { id, clienteId, active: true } });
  if (!product) throw new Error("Página não encontrada neste workspace.");
  const warnings: string[] = [];
  const page = product.salesPage as Record<string, unknown> | null;
  const formId = typeof page?.formId === "string" ? page.formId : null;
  if (formId) {
    const form = await getCaptureFormById(clienteId, formId);
    if (form && form.status !== "PUBLISHED") await updateCaptureFormStatus(clienteId, formId, "PUBLISHED");
    if (!form) warnings.push("O formulário vinculado não existe mais; a página usa nome/e-mail/WhatsApp.");
  }
  const checkoutId = typeof page?.checkoutProductId === "string" ? page.checkoutProductId : null;
  if (checkoutId && checkoutId !== product.id) {
    const cp = await prisma.commerceProduct.findFirst({ where: { id: checkoutId, clienteId }, select: { status: true, name: true } });
    if (cp && cp.status !== "PUBLISHED") warnings.push(`O produto "${cp.name}" do checkout está em rascunho — publique-o para vender.`);
  }
  if (page?.goal === "sales" && !(await getMpPublicKey(clienteId))) {
    warnings.push("Mercado Pago não conectado: o checkout não consegue cobrar até conectar em Config → Conexões.");
  }
  const updated = await prisma.commerceProduct.update({
    where: { id: product.id },
    data: { status: "PUBLISHED" },
    select: { id: true, name: true, slug: true },
  });
  return { kind, id: updated.id, name: updated.name, status: "PUBLISHED", publicPath: publicPath("oferta", updated.slug), warnings };
}

// ── brief ──

async function workspaceBrand(clienteId: string) {
  const config = await getWorkspaceConfig(clienteId).catch(() => null);
  return config ? resolveBrand(config) : null;
}

function errorResult(tool: string, label: string, message: string): ToolResult {
  return { data: { erro: message }, coverage: "empty", source: { tool, label } };
}

function commerceOn(rt: ToolRuntime) {
  return rt.ctx.modules.length === 0 || rt.ctx.modules.includes("commerce");
}

const MIN_FIX_WINDOW_MS = 110_000;

/** Gera, valida e (se der tempo) corrige uma vez. */
async function designPage(
  rt: ToolRuntime,
  brief: DesignBrief,
  build: (out: { html: string; css: string; fonts: string[]; theme: DesignOutput["theme"]; model: string }) => LpSalesPageV3,
  needs: { needsForm: boolean; needsCheckout: boolean },
  edit?: { current: { html: string; css: string }; instructions: string },
) {
  const started = Date.now();
  /* Fatos aceitos: o que o usuário escreveu (o briefing é do assistente e pode inventar); na edição, o que já estava na página. */
  const said = rt.userText ?? [brief.briefing, brief.estilo, brief.cta, edit?.instructions].filter(Boolean).join("\n");
  const source = [brief.negocio, brief.segmento, brief.produto?.nome, said, edit ? htmlText(edit.current.html) : null]
    .filter(Boolean)
    .join("\n");
  const checks = { ...needs, source };
  const first = await runDesigner(
    rt.ctx.clienteId,
    edit ? { mode: "edit", brief, current: edit.current, instructions: edit.instructions } : { mode: "create", brief },
    { signal: rt.signal, onProgress: rt.onProgress, budgetMs: 180_000 },
  );
  let page = build(first);
  let issues = validateLpV3(page, checks);
  let notes = first.notes;
  if (issues.length && Date.now() - started < MIN_FIX_WINDOW_MS) {
    rt.onProgress?.("Revisando o design");
    try {
      const fixed = await runDesigner(
        rt.ctx.clienteId,
        { mode: "fix", brief, current: { html: first.html, css: first.css }, issues: issues.map((i) => i.message) },
        { signal: rt.signal, onProgress: rt.onProgress, budgetMs: 100_000 },
      );
      const candidate = build(fixed);
      const remaining = validateLpV3(candidate, checks);
      if (remaining.length < issues.length) {
        page = candidate;
        issues = remaining;
        notes = fixed.notes || notes;
      }
    } catch (error) {
      if (rt.signal?.aborted) throw error;
    }
  }
  return { page, issues, notes };
}

async function ensureForm(
  rt: ToolRuntime,
  args: Record<string, unknown>,
  pageName: string,
): Promise<{ form: CaptureFormRow | null; created: boolean; error?: string }> {
  const existingId = str(args.formulario_id, 80);
  if (existingId) {
    const form = await getCaptureFormById(rt.ctx.clienteId, existingId);
    return form ? { form, created: false } : { form: null, created: false, error: "Formulário informado não existe neste workspace." };
  }
  const normalized = normalizeFormArgs({
    nome: `${pageName} — formulário`,
    titulo_etapa: "Seus dados",
    campos: Array.isArray(args.campos_formulario) ? args.campos_formulario : [],
  });
  const steps: FormStep[] = [{ id: "step_1", title: normalized.titulo, fields: normalized.campos }];
  const slug = await uniqueGlobalFormSlug(normalized.nome);
  const form = await createCaptureForm({
    clienteId: rt.ctx.clienteId,
    name: normalized.nome,
    slug,
    steps,
    source: "assistente",
    status: "DRAFT",
  });
  return { form, created: true };
}

// ── teste ──

function selfOrigin() {
  return process.env.ATRAKO_INTERNAL_ORIGIN || `http://127.0.0.1:${process.env.PORT || 5000}`;
}

async function selfFetch(path: string, init?: RequestInit) {
  const origin = selfOrigin();
  return fetch(`${origin}${path}`, {
    ...init,
    headers: { origin, ...(init?.headers ?? {}) },
    signal: AbortSignal.timeout(30_000),
    cache: "no-store",
  });
}

async function testForm(form: CaptureFormRow, token: string, steps: TestStep[]): Promise<Record<string, string>> {
  const fields = flattenFields(form.steps);
  const contact = fields.some((f) => f.type === "email" || f.type === "phone");
  steps.push({
    label: "Formulário vinculado",
    ok: fields.length > 0 && contact,
    detail: `${fields.length} pergunta(s)${contact ? "" : " — falta um campo de contato (e-mail ou WhatsApp)"}`,
  });
  const answers = sampleAnswers(fields);
  const local = validateFormAnswers(fields, answers);
  let submitted = { ok: local.ok, detail: local.ok ? "Respostas de exemplo aceitas" : local.errors.map((e) => `${e.label}: ${e.message}`).join("; ") };
  try {
    const r = await selfFetch("/api/atrako/forms", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ action: "complete", slug: form.slug, answers, preview: token }),
    });
    const j = (await r.json().catch(() => ({}))) as { ok?: boolean; test?: boolean; error?: string };
    submitted = r.ok && j.test
      ? { ok: true, detail: "Servidor validou o envio em modo teste (nenhum lead criado)" }
      : { ok: false, detail: j.error ?? `Servidor respondeu ${r.status}` };
  } catch {
    /* sem auto-chamada (ex.: ambiente de testes): fica a validação local */
  }
  steps.push({ label: "Envio de teste", ...submitted });
  const required = fields.filter((f) => f.required);
  if (required.length) {
    const empty = validateFormAnswers(fields, []);
    steps.push({
      label: "Bloqueia envio incompleto",
      ok: !empty.ok,
      detail: empty.ok ? "Aceitou envio vazio" : `${empty.errors.length} campo(s) obrigatório(s) cobrados`,
    });
  }
  return Object.fromEntries(fields.map((f) => [f.label, local.values[f.id] ?? ""]).filter(([, v]) => v));
}

// ── ferramentas ──

export const CREATOR_TOOLS: AtrakoTool[] = [
  {
    name: "criar_landing_page",
    step: "Criando a landing page",
    longRunning: true,
    oncePerTurn: true,
    description:
      "Cria uma landing page de alta qualidade em HTML (design e copy feitos por IA) já integrada ao formulário (captura) ou ao checkout (venda) do Atrako. Fica em RASCUNHO e abre a prévia na conversa. Antes, se o usuário citar referências/sites/estilo, use ler_pagina ou pesquisar_web e resuma em 'referencias'. Não publica.",
    parameters: objectSchema({
      nome: { type: "string", description: "Nome interno da página." },
      objetivo: {
        type: "string",
        enum: ["leads", "sales"],
        description: "sales = página de vendas com checkout (usuário fala em vender, preço, compra, checkout); leads = captar contatos com formulário.",
      },
      briefing: {
        type: "string",
        description:
          "Tudo sobre a oferta: o que é, público, dor, promessa, diferenciais, tom, seções desejadas. Seja detalhado, mas só com fatos que o usuário deu: sem inventar depoimentos, bônus, garantia, instrutor ou números.",
      },
      estilo: nullableString("Direção visual: cores, clima (ex.: minimalista escuro, editorial, vibrante), referências visuais descritas."),
      referencias: nullableString("Resumo do que foi aprendido nas referências da web (estrutura, estilo, argumentos)."),
      referencias_urls: { type: ["array", "null"], items: { type: "string" }, description: "Links das referências usadas." },
      cta: nullableString("Texto principal do botão."),
      formulario_id: nullableString("Só captura (leads): id de formulário existente. Null = criar um novo com campos_formulario."),
      campos_formulario: {
        type: ["array", "null"],
        items: fieldItems,
        description: "Só captura (leads): perguntas do formulário novo (inclua nome e um contato). Em venda use null — o checkout já pede os dados do comprador.",
      },
      produto_checkout_id: nullableString("Id de produto existente para vender (venda). Null = a própria página é o produto, com preco_reais."),
      preco_reais: { type: ["number", "null"], description: "Preço em reais quando a própria página é o produto." },
    }),
    risk: "WRITE",
    async run(args, rt) {
      const tool = "criar_landing_page";
      const label = "Landing page criada";
      const goal =
        args.objetivo === "sales" || Number(args.preco_reais) > 0 || str(args.produto_checkout_id, 80) ? "sales" : "leads";
      const nome = str(args.nome, 120) || "Landing page";
      const briefing = str(args.briefing, 4000);
      if (briefing.length < 20) return errorResult(tool, label, "Briefing curto demais — pergunte ao usuário sobre a oferta e o público.");
      if (goal === "sales" && !commerceOn(rt)) return errorResult(tool, label, "O módulo de vendas (commerce) está desligado neste workspace.");

      rt.onProgress?.("Preparando formulário e checkout");
      let form: CaptureFormRow | null = null;
      let formCreated = false;
      if (goal === "leads") {
        const ensured = await ensureForm(rt, args, nome);
        if (ensured.error) return errorResult(tool, label, ensured.error);
        form = ensured.form;
        formCreated = ensured.created;
      }
      let checkout: { id: string; name: string; priceCents: number } | null = null;
      const priceReais = Number(args.preco_reais);
      const priceCents = Number.isFinite(priceReais) && priceReais > 0 ? Math.round(priceReais * 100) : 0;
      if (goal === "sales") {
        const pid = str(args.produto_checkout_id, 80);
        if (pid) {
          checkout = await prisma.commerceProduct.findFirst({
            where: { id: pid, clienteId: rt.ctx.clienteId, active: true, priceCents: { gt: 0 } },
            select: { id: true, name: true, priceCents: true },
          });
          if (!checkout) return errorResult(tool, label, "Produto do checkout não encontrado (ou sem preço) neste workspace.");
        } else if (!priceCents) {
          return errorResult(tool, label, "Para vender, informe o preço (preco_reais) ou o id de um produto existente.");
        }
      }

      const brand = await workspaceBrand(rt.ctx.clienteId);
      const brief: DesignBrief = {
        negocio: brand?.name || rt.ctx.nome,
        segmento: rt.ctx.segmento,
        objetivo: goal,
        nome,
        briefing,
        estilo: str(args.estilo, 1200) || null,
        referencias: str(args.referencias, 3000) || null,
        cta: str(args.cta, 60) || null,
        corMarca: brand?.primaryColor ?? null,
        logoUrl: brand?.logoUrl ?? null,
        produto: goal === "sales" ? { nome: checkout?.name ?? nome, precoReais: (checkout?.priceCents ?? priceCents) / 100 || null } : null,
        formulario: form ? { nome: form.name, campos: flattenFields(form.steps).map((f) => f.label) } : null,
        pedidoOriginal: rt.userText?.slice(-4000) || null,
      };
      const references = Array.isArray(args.referencias_urls)
        ? args.referencias_urls.filter((u): u is string => typeof u === "string" && /^https?:\/\//.test(u)).slice(0, 10)
        : [];

      let designed;
      try {
        designed = await designPage(
          rt,
          brief,
          (out) =>
            buildSalesPageV3({
              goal,
              html: out.html,
              css: out.css,
              fonts: out.fonts,
              theme: out.theme,
              formId: form?.id ?? null,
              checkoutProductId: checkout?.id ?? null,
              brief: briefing,
              references,
              generatedBy: out.model,
            }),
          { needsForm: goal === "leads", needsCheckout: goal === "sales" },
        );
      } catch (error) {
        if (rt.signal?.aborted) throw error;
        return errorResult(tool, label, error instanceof DesignError ? error.message : "Não consegui gerar a página agora.");
      }

      rt.onProgress?.("Salvando o rascunho");
      const slug = await uniqueGlobalProductSlug(nome);
      const product = await prisma.commerceProduct.create({
        data: {
          clienteId: rt.ctx.clienteId,
          name: nome,
          slug,
          priceCents: goal === "sales" && !checkout ? priceCents : 0,
          description: briefing.slice(0, 280),
          type: goal === "sales" ? "OTHER" : "SERVICE",
          status: "DRAFT",
          active: true,
          salesPage: designed.page as unknown as Prisma.InputJsonValue,
        },
        select: { id: true, clienteId: true, name: true, slug: true, status: true, salesPage: true },
      });

      const artifacts: Artifact[] = [lpPreviewArtifact(product)];
      if (form && formCreated) {
        artifacts.push({
          kind: "resource_created",
          id: artifactId("res"),
          resource: "form",
          resourceId: form.id,
          name: form.name,
          status: "DRAFT",
          editPath: FORM_EDIT_PATH,
        });
      }
      return {
        data: {
          pagina: { id: product.id, nome: product.name, status: "rascunho", tipo: goal === "sales" ? "página de vendas" : "página de captura" },
          formulario: form
            ? { id: form.id, nome: form.name, novo: formCreated, campos: flattenFields(form.steps).map((f) => f.label) }
            : null,
          checkout: goal === "sales" ? { produto: checkout?.name ?? nome, preco: (checkout?.priceCents ?? priceCents) / 100 } : null,
          conceito_do_designer: designed.notes,
          pontos_a_melhorar: designed.issues.map((i) => i.message),
          proximo_passo:
            "A página JÁ FOI CRIADA (não chame criar_landing_page de novo). A prévia está aberta na conversa (computador/celular). Resuma o conceito em 2-3 frases; se houver pontos_a_melhorar, cite-os em uma frase e pergunte se quer que você ajuste (não ajuste sem o usuário pedir). Ofereça também testar o formulário/checkout ou publicar.",
        },
        coverage: "available",
        source: { tool, label },
        artifacts,
      };
    },
  },
  {
    name: "editar_landing_page",
    step: "Ajustando a landing page",
    longRunning: true,
    oncePerTurn: true,
    description:
      "Edita uma landing page criada pelo assistente (HTML v3) conforme o pedido: textos, cores, seções, ordem, estilo. Mantém formulário/checkout. Se a página estiver publicada, a mudança vai ao ar. Abre a nova prévia na conversa.",
    parameters: objectSchema({
      pagina_id: { type: "string", description: "Id da página (veja o histórico da conversa ou paginas_e_formularios)." },
      instrucoes: { type: "string", description: "O que mudar, de forma específica." },
      referencias: nullableString("Resumo de referências novas, se houver."),
    }),
    risk: "WRITE",
    async run(args, rt) {
      const tool = "editar_landing_page";
      const label = "Landing page ajustada";
      const id = str(args.pagina_id, 80);
      const instructions = str(args.instrucoes, 3000);
      if (!instructions) return errorResult(tool, label, "Diga o que mudar.");
      const product = await prisma.commerceProduct.findFirst({
        where: { id, clienteId: rt.ctx.clienteId, active: true },
        select: { id: true, clienteId: true, name: true, slug: true, status: true, salesPage: true, priceCents: true },
      });
      if (!product) return errorResult(tool, label, "Página não encontrada neste workspace.");
      const current = product.salesPage;
      if (!isLpSalesPageV3(current)) {
        return errorResult(tool, label, "Esta página foi feita no editor visual (não em HTML). Posso criar uma versão nova em HTML com criar_landing_page.");
      }
      const form = current.formId ? await getCaptureFormById(rt.ctx.clienteId, current.formId) : null;
      const brand = await workspaceBrand(rt.ctx.clienteId);
      const brief: DesignBrief = {
        negocio: brand?.name || rt.ctx.nome,
        segmento: rt.ctx.segmento,
        objetivo: current.goal,
        nome: product.name,
        briefing: current.brief,
        estilo: null,
        referencias: str(args.referencias, 3000) || null,
        cta: null,
        corMarca: brand?.primaryColor ?? null,
        logoUrl: brand?.logoUrl ?? null,
        produto: current.goal === "sales" ? { nome: product.name, precoReais: product.priceCents / 100 || null } : null,
        formulario: form ? { nome: form.name, campos: flattenFields(form.steps).map((f) => f.label) } : null,
      };
      let designed;
      try {
        designed = await designPage(
          rt,
          brief,
          (out) => ({
            ...buildSalesPageV3({
              goal: current.goal,
              html: out.html,
              css: out.css,
              fonts: out.fonts.length ? out.fonts : current.fonts,
              theme: out.theme.accent ? out.theme : current.theme,
              formId: current.formId ?? null,
              checkoutProductId: current.checkoutProductId ?? null,
              brief: current.brief,
              references: current.references,
              generatedBy: out.model,
            }),
            previous: { html: current.html, css: current.css, cssSource: current.cssSource, updatedAt: current.updatedAt },
          }),
          { needsForm: current.goal === "leads", needsCheckout: current.goal === "sales" },
          { current: { html: current.html, css: current.cssSource ?? "" }, instructions },
        );
      } catch (error) {
        if (rt.signal?.aborted) throw error;
        return errorResult(tool, label, error instanceof DesignError ? error.message : "Não consegui ajustar a página agora.");
      }
      const updated = await prisma.commerceProduct.update({
        where: { id: product.id },
        data: { salesPage: designed.page as unknown as Prisma.InputJsonValue },
        select: { id: true, clienteId: true, name: true, slug: true, status: true, salesPage: true },
      });
      return {
        data: {
          pagina: { id: updated.id, nome: updated.name, status: updated.status === "PUBLISHED" ? "publicada (mudança já está no ar)" : "rascunho" },
          o_que_mudou: designed.notes,
          pontos_a_melhorar: designed.issues.map((i) => i.message),
        },
        coverage: "available",
        source: { tool, label },
        artifacts: [lpPreviewArtifact(updated)],
      };
    },
  },
  {
    name: "criar_formulario",
    step: "Criando o formulário",
    module: "forms",
    oncePerTurn: true,
    description:
      "Cria um formulário de captura/qualificação do Atrako (vira lead no CRM) em RASCUNHO e abre a prévia na conversa. Inclua nome e um contato (e-mail ou WhatsApp). Não publica.",
    parameters: objectSchema({
      nome: { type: "string", description: "Nome do formulário." },
      titulo_etapa: nullableString("Título exibido acima das perguntas."),
      campos: { type: "array", items: fieldItems, description: "Perguntas na ordem." },
    }),
    risk: "WRITE",
    async run(args, rt) {
      const a = normalizeFormArgs(args);
      const steps: FormStep[] = [{ id: "step_1", title: a.titulo, fields: a.campos }];
      const form = await createCaptureForm({
        clienteId: rt.ctx.clienteId,
        name: a.nome,
        slug: await uniqueGlobalFormSlug(a.nome),
        steps,
        source: "assistente",
        status: "DRAFT",
      });
      return {
        data: {
          formulario: { id: form.id, nome: form.name, status: "rascunho", perguntas: a.campos.map((c) => c.label) },
          proximo_passo: "A prévia está aberta na conversa. Ofereça testar, ajustar perguntas ou publicar.",
        },
        coverage: "available",
        source: { tool: "criar_formulario", label: "Formulário criado" },
        artifacts: [formPreviewArtifact(form)],
      };
    },
  },
  {
    name: "testar_landing_page",
    step: "Testando",
    description:
      "Testa uma landing page e/ou formulário em modo teste (nada vira lead ou pedido): abre a página, confere marcadores, envia respostas de exemplo pelo servidor, verifica validação e checkout. Mostra o resultado na conversa.",
    parameters: objectSchema({
      pagina_id: nullableString("Id da landing page a testar."),
      formulario_id: nullableString("Id do formulário a testar (quando não há página)."),
    }),
    risk: "READ",
    async run(args, rt) {
      const ws = rt.ctx.clienteId;
      const steps: TestStep[] = [];
      let submitted: Record<string, string> | undefined;
      let title = "Teste";
      const pageId = str(args.pagina_id, 80);
      const formId = str(args.formulario_id, 80);

      if (pageId) {
        const product = await prisma.commerceProduct.findFirst({
          where: { id: pageId, clienteId: ws, active: true },
          select: { id: true, name: true, slug: true, status: true, salesPage: true, priceCents: true },
        });
        if (!product) return errorResult("testar_landing_page", "Teste", "Página não encontrada neste workspace.");
        title = `Teste da página "${product.name}"`;
        const page = product.salesPage;
        const v3 = isLpSalesPageV3(page) ? page : null;
        const goal = (page as { goal?: string } | null)?.goal === "sales" ? "sales" : "leads";
        if (v3) {
          const issues = validateLpV3(v3, { needsForm: goal === "leads", needsCheckout: goal === "sales" });
          steps.push({ label: "Estrutura da página", ok: issues.length === 0, detail: issues.length ? issues.map((i) => i.message).join(" ") : "Título, seções, marcadores e responsivo ok" });
        }
        const token = createPreviewToken({ kind: "lp", id: product.id, clienteId: ws });
        try {
          const r = await selfFetch(lpPreviewPath(product.slug, token));
          const body = await r.text();
          const rendered = r.ok && (!v3 || body.includes("atrako-lp-v3"));
          steps.push({ label: "Página abre", ok: rendered, detail: rendered ? "Carregou em modo prévia" : `Respondeu ${r.status}` });
        } catch (error) {
          steps.push({ label: "Página abre", ok: false, detail: error instanceof Error ? error.message.slice(0, 120) : "Falhou" });
        }
        const linkedForm = typeof (page as { formId?: unknown } | null)?.formId === "string"
          ? await getCaptureFormById(ws, (page as { formId: string }).formId)
          : null;
        if (goal === "leads") {
          if (linkedForm) submitted = await testForm(linkedForm, token, steps);
          else steps.push({ label: "Formulário vinculado", ok: false, detail: "Sem formulário: a página usa só nome/e-mail/WhatsApp" });
        } else {
          const checkoutId = (page as { checkoutProductId?: string } | null)?.checkoutProductId;
          const cp = checkoutId
            ? await prisma.commerceProduct.findFirst({ where: { id: checkoutId, clienteId: ws }, select: { priceCents: true, status: true, name: true } })
            : { priceCents: product.priceCents, status: product.status, name: product.name };
          steps.push({
            label: "Checkout configurado",
            ok: Boolean(cp && cp.priceCents > 0),
            detail: cp ? `${cp.name} — ${(cp.priceCents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}` : "Produto do checkout não encontrado",
          });
          steps.push({ label: "Compra simulada", ok: true, detail: "No modo teste o checkout aprova sem cobrar" });
          const mp = await getMpPublicKey(ws);
          steps.push({ label: "Mercado Pago conectado", ok: Boolean(mp), detail: mp ? "Pronto para cobrar de verdade" : "Conecte em Config → Conexões para vender de verdade" });
        }
        steps.push({
          label: "Publicação",
          ok: true,
          detail: product.status === "PUBLISHED" ? "Página no ar" : "Rascunho — publique quando aprovar",
        });
      } else if (formId) {
        const form = await getCaptureFormById(ws, formId);
        if (!form) return errorResult("testar_landing_page", "Teste", "Formulário não encontrado neste workspace.");
        title = `Teste do formulário "${form.name}"`;
        const token = createPreviewToken({ kind: "form", id: form.id, clienteId: ws });
        try {
          const r = await selfFetch(`/api/atrako/forms?preview=${encodeURIComponent(token)}`);
          steps.push({ label: "Formulário abre", ok: r.ok, detail: r.ok ? "Carregou em modo prévia" : `Respondeu ${r.status}` });
        } catch {
          /* sem auto-chamada */
        }
        submitted = await testForm(form, token, steps);
      } else {
        return errorResult("testar_landing_page", "Teste", "Informe pagina_id ou formulario_id.");
      }

      const ok = steps.filter((s) => s.label !== "Mercado Pago conectado").every((s) => s.ok);
      return {
        data: { titulo: title, aprovado: ok, etapas: steps.map((s) => `${s.ok ? "OK" : "FALHOU"} — ${s.label}: ${s.detail ?? ""}`) },
        coverage: "available",
        source: { tool: "testar_landing_page", label: "Teste em modo prévia" },
        artifacts: [{ kind: "test_result", id: artifactId("test"), title, ok, steps, ...(submitted ? { submitted } : {}) }],
      };
    },
  },
  {
    name: "publicar",
    step: "Publicando",
    description:
      "Publica (coloca no ar) uma landing page ou formulário. Use SOMENTE quando o usuário pedir explicitamente para publicar/colocar no ar nesta conversa. Publicar a página publica junto o formulário vinculado.",
    parameters: objectSchema({
      tipo: { type: "string", enum: ["landing_page", "formulario"] },
      id: { type: "string", description: "Id da página ou do formulário." },
    }),
    risk: "WRITE",
    async run(args, rt) {
      const kind = args.tipo === "formulario" ? "form" : "landing_page";
      try {
        const result = await publishResource(rt.ctx.clienteId, kind, str(args.id, 80));
        const artifacts: Artifact[] = [];
        if (kind === "landing_page") {
          const p = await prisma.commerceProduct.findFirst({
            where: { id: result.id, clienteId: rt.ctx.clienteId },
            select: { id: true, clienteId: true, name: true, slug: true, status: true, salesPage: true },
          });
          if (p) artifacts.push(lpPreviewArtifact(p));
        } else {
          const f = await getCaptureFormById(rt.ctx.clienteId, result.id);
          if (f) artifacts.push(formPreviewArtifact(f));
        }
        return {
          data: { publicado: result.name, endereco: result.publicPath, avisos: result.warnings },
          coverage: "available",
          source: { tool: "publicar", label: "Publicação" },
          artifacts,
        };
      } catch (error) {
        return errorResult("publicar", "Publicação", error instanceof Error ? error.message : "Não consegui publicar.");
      }
    },
  },
];
