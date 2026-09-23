import { NextRequest, NextResponse } from "next/server";
import {
  createCaptureForm,
  createCaptureFormFromBrief,
  completeCaptureForm,
  getCaptureFormById,
  getCaptureFormBySlug,
  listCaptureForms,
} from "@/lib/modules/capture-form";
import { createNativeLead } from "@/lib/modules/crm";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { getWorkspaceConfig } from "@/lib/config/getWorkspaceConfig";
import { previewForm, type FormStep } from "@atrako/forms";
import { publicPath } from "@/lib/criar/slug";
import { pickAttributionFromBody } from "@/lib/criar/lp-attribution";
import { createLeadEvent, publishAtrakoEvents } from "@/lib/atrako/events";

export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const slug = request.nextUrl.searchParams.get("slug")?.trim();
  const id = request.nextUrl.searchParams.get("id")?.trim();

  if (slug) {
    const form = await getCaptureFormBySlug(slug);
    if (!form) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({
      form: {
        id: form.id,
        name: form.name,
        slug: form.slug,
        status: form.status,
        steps: form.steps,
        source: form.source,
      },
    });
  }

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  if (id) {
    const form = await getCaptureFormById(workspaceId, id);
    if (!form) return NextResponse.json({ error: "not found" }, { status: 404 });
    return NextResponse.json({ form });
  }

  const forms = await listCaptureForms(workspaceId);
  return NextResponse.json({
    forms: forms.map((f) => ({
      ...f,
      path: publicPath("formulario", f.slug),
      createdAt: f.createdAt.toISOString(),
      updatedAt: f.updatedAt.toISOString(),
    })),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const action = typeof input.action === "string" ? input.action : "publish";
  const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId : "";

  if (action === "complete") {
    const slug = typeof input.slug === "string" ? input.slug : "";
    const answers = Array.isArray(input.answers) ? input.answers : [];
    if (!slug) return NextResponse.json({ error: "slug required" }, { status: 400 });
    try {
      const result = await completeCaptureForm({
        slug,
        answers: answers as Array<{ fieldId: string; value: string }>,
        attribution: pickAttributionFromBody(input),
      });
      return NextResponse.json({ ok: true, ...result }, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao enviar" },
        { status: 400 },
      );
    }
  }

  /** Lead direto da LP (sem CaptureForm publicado). */
  if (action === "lp_lead") {
    if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
      return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
    }
    const nome = typeof input.nome === "string" ? input.nome.trim() : "";
    const email = typeof input.email === "string" ? input.email.trim() : "";
    const telefone =
      typeof input.telefone === "string" ? input.telefone.trim() : undefined;
    if (!nome || !email.includes("@")) {
      return NextResponse.json({ error: "nome e e-mail obrigatórios" }, { status: 400 });
    }
    try {
      const attribution = pickAttributionFromBody(input);
      const pageSlug =
        typeof attribution.pageSlug === "string" ? attribution.pageSlug : "";
      const productId =
        typeof attribution.productId === "string" ? attribution.productId : "";
      const source = pageSlug
        ? `lp:${pageSlug}`
        : productId
          ? `lp:${productId}`
          : "lp";

      const lead = await createNativeLead({
        clienteId: workspaceId,
        name: nome,
        email,
        phone: telefone || undefined,
        source,
        metadata: {
          channel: "lp",
          convertedAt: new Date().toISOString(),
          ...attribution,
        },
      });

      await publishAtrakoEvents([
        createLeadEvent({
          name: "lead.created",
          workspaceId,
          leadId: lead.id,
          contactId: lead.contactId ?? undefined,
          idempotencyKey: `lp-lead-${lead.id}`,
          payload: {
            nome,
            email,
            telefone,
            fonte: source,
            ...attribution,
          },
        }),
      ]);

      return NextResponse.json({ ok: true, leadId: lead.id }, { status: 201 });
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao criar lead" },
        { status: 400 },
      );
    }
  }

  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const config = await getWorkspaceConfig(workspaceId);
  const formsPrefs = (config?.settings as Record<string, unknown> | null)?.formsPrefs as
    | { defaultSource?: string }
    | undefined;
  const defaultSource = formsPrefs?.defaultSource || "form";

  if (action === "preview" || action === "brief") {
    const brief = typeof input.brief === "string" ? input.brief : "Formulário Atrako";
    const { createFormFromBrief } = await import("@atrako/forms");
    const draft = createFormFromBrief({ workspaceId, brief });
    return NextResponse.json({
      status: "PREVIEW",
      form: draft,
      preview: previewForm(draft),
    });
  }

  if (action === "publish" || action === "create") {
    try {
      let form;
      if (typeof input.brief === "string" && input.brief.trim() && !input.steps) {
        form = await createCaptureFormFromBrief({
          clienteId: workspaceId,
          brief: input.brief.trim(),
          source: typeof input.source === "string" ? input.source : defaultSource,
        });
      } else {
        const name = typeof input.name === "string" ? input.name.trim() : "";
        const steps = Array.isArray(input.steps) ? (input.steps as FormStep[]) : [];
        if (!name || !steps.length) {
          return NextResponse.json({ error: "name e steps obrigatórios" }, { status: 400 });
        }
        form = await createCaptureForm({
          clienteId: workspaceId,
          name,
          slug: typeof input.slug === "string" ? input.slug : undefined,
          steps,
          source: typeof input.source === "string" ? input.source : defaultSource,
          status: "PUBLISHED",
        });
      }
      const path = publicPath("formulario", form.slug);
      return NextResponse.json(
        {
          status: "PUBLISHED",
          form: {
            id: form.id,
            name: form.name,
            slug: form.slug,
            status: form.status,
            steps: form.steps,
            path,
          },
          path,
        },
        { status: 201 },
      );
    } catch (e) {
      return NextResponse.json(
        { error: e instanceof Error ? e.message : "Falha ao publicar" },
        { status: 400 },
      );
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}
