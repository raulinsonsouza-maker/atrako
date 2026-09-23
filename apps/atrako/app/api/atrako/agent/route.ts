import { NextRequest, NextResponse } from "next/server";
import {
  createDefaultAgentToolRegistry,
  type AgentContext,
} from "@atrako/agent";
import { createFormFromBrief, previewForm } from "@atrako/forms";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

const registry = createDefaultAgentToolRegistry();

async function guestOrUserContext(workspaceId: string): Promise<AgentContext> {
  return {
    workspaceId,
    userId: "guest",
    roles: ["OPERATOR"],
    traceId: crypto.randomUUID(),
  };
}

export async function GET() {
  return NextResponse.json({
    agent: "Atrako",
    greeting: "Olá, eu sou o Atrako. Como posso te ajudar hoje?",
    tools: registry.list(),
  });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid agent request" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const workspaceId =
    typeof input.workspaceId === "string" && input.workspaceId.trim()
      ? input.workspaceId.trim()
      : "guest";
  const toolName = typeof input.toolName === "string" ? input.toolName : "";
  const toolInput =
    typeof input.input === "object" && input.input !== null && !Array.isArray(input.input)
      ? (input.input as Record<string, unknown>)
      : {};
  const previewOnly = input.previewOnly !== false;
  const confirmed = input.confirmed === true;

  if (!toolName) {
    return NextResponse.json({ error: "toolName is required" }, { status: 400 });
  }

  if (workspaceId !== "guest") {
    const access = await requireWorkspaceAccess(workspaceId, "operate");
    if (!access.ok) return access.response;
    const workspace = await findWorkspaceById(workspaceId).catch(() => null);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
    }
  }

  const context = await guestOrUserContext(workspaceId);
  const execution = await registry.execute(
    { toolName, input: toolInput },
    context,
    { confirmed, previewOnly },
  );

  if (toolName === "forms.create_draft" && execution.status === "PREVIEW") {
    const form = createFormFromBrief({
      workspaceId,
      brief: String(toolInput.brief ?? toolInput.query ?? "Formulário"),
    });
    execution.result = previewForm(form);
    if (execution.plan.preview) execution.plan.preview = execution.result;
  }

  if (
    toolName === "forms.create_draft" &&
    confirmed &&
    workspaceId !== "guest" &&
    execution.status !== "ERROR"
  ) {
    try {
      const { createCaptureFormFromBrief } = await import("@/lib/modules/capture-form");
      const { publicPath } = await import("@/lib/criar/slug");
      const published = await createCaptureFormFromBrief({
        clienteId: workspaceId,
        brief: String(toolInput.brief ?? toolInput.query ?? "Formulário"),
      });
      execution.result = {
        ...previewForm({
          id: published.id,
          workspaceId,
          name: published.name,
          status: "PUBLISHED",
          steps: published.steps,
        }),
        path: publicPath("formulario", published.slug),
        slug: published.slug,
      };
      execution.status = "DONE";
    } catch {
      /* keep preview */
    }
  }

  if (
    toolName === "pages.create_draft" &&
    confirmed &&
    workspaceId !== "guest" &&
    execution.status !== "ERROR"
  ) {
    try {
      const { prisma } = await import("@/lib/db");
      const { slugify, publicPath } = await import("@/lib/criar/slug");
      const name = String(toolInput.name ?? toolInput.headline ?? toolInput.brief ?? "Oferta").slice(0, 120);
      const headline = String(toolInput.headline ?? name);
      const slug = slugify(String(toolInput.slug ?? name));
      const product = await prisma.commerceProduct.create({
        data: {
          clienteId: workspaceId,
          name,
          slug,
          priceCents: typeof toolInput.priceCents === "number" ? toolInput.priceCents : 0,
          description: typeof toolInput.description === "string" ? toolInput.description : null,
          status: "PUBLISHED",
          active: true,
          salesPage: {
            headline,
            subheadline: typeof toolInput.subheadline === "string" ? toolInput.subheadline : undefined,
            bullets: Array.isArray(toolInput.bullets) ? toolInput.bullets : [],
            cta: typeof toolInput.cta === "string" ? toolInput.cta : "Quero comprar",
          },
        },
      });
      execution.result = {
        productId: product.id,
        slug: product.slug,
        path: publicPath("oferta", product.slug),
      };
      execution.status = "DONE";
    } catch {
      /* keep preview */
    }
  }

  return NextResponse.json({ plan: execution.plan, execution });
}
