export type AgentToolRisk = "READ" | "DRAFT" | "WRITE" | "EXTERNAL_SIDE_EFFECT";

export type AgentRole = "OWNER" | "ADMIN" | "OPERATOR" | "ANALYST";

export interface AgentContext {
  workspaceId: string;
  userId: string;
  roles: AgentRole[];
  traceId: string;
}

export interface AgentToolDefinition {
  name: string;
  description: string;
  risk: AgentToolRisk;
  requiredRoles?: AgentRole[];
  inputSchema: Record<string, unknown>;
}

export interface AgentToolCall {
  toolName: string;
  input: Record<string, unknown>;
}

export type AgentPlanStatus = "READY" | "NEEDS_CONFIRMATION" | "DENIED" | "UNKNOWN_TOOL";

export interface AgentToolPlan {
  status: AgentPlanStatus;
  tool: AgentToolDefinition | null;
  call: AgentToolCall;
  reason?: string;
  preview?: Record<string, unknown>;
}

export type AgentExecutionStatus =
  | "PREVIEW"
  | "EXECUTED"
  | "NEEDS_CONFIRMATION"
  | "DENIED"
  | "UNKNOWN_TOOL";

export interface AgentExecutionResult {
  status: AgentExecutionStatus;
  plan: AgentToolPlan;
  result?: Record<string, unknown>;
}

const rolesByPriority: AgentRole[] = ["ANALYST", "OPERATOR", "ADMIN", "OWNER"];

function hasRequiredRole(context: AgentContext, definition: AgentToolDefinition): boolean {
  if (!definition.requiredRoles || definition.requiredRoles.length === 0) return true;
  const highestRoleIndex = Math.max(...context.roles.map((role) => rolesByPriority.indexOf(role)));
  return definition.requiredRoles.some((role) => highestRoleIndex >= rolesByPriority.indexOf(role));
}

export type AgentToolHandler = (
  call: AgentToolCall,
  context: AgentContext,
) => Promise<Record<string, unknown>> | Record<string, unknown>;

export class AgentToolRegistry {
  private readonly definitions = new Map<string, AgentToolDefinition>();
  private readonly handlers = new Map<string, AgentToolHandler>();

  register(definition: AgentToolDefinition, handler?: AgentToolHandler): this {
    if (this.definitions.has(definition.name)) {
      throw new Error(`Agent tool already registered: ${definition.name}`);
    }
    this.definitions.set(definition.name, definition);
    if (handler) this.handlers.set(definition.name, handler);
    return this;
  }

  list(): AgentToolDefinition[] {
    return [...this.definitions.values()];
  }

  plan(call: AgentToolCall, context: AgentContext, confirmed = false): AgentToolPlan {
    const tool = this.definitions.get(call.toolName);
    if (!tool) return { status: "UNKNOWN_TOOL", tool: null, call, reason: "Tool not registered" };
    if (!context.workspaceId) return { status: "DENIED", tool, call, reason: "Workspace is required" };
    if (!hasRequiredRole(context, tool)) return { status: "DENIED", tool, call, reason: "Insufficient role" };
    if (tool.risk === "EXTERNAL_SIDE_EFFECT" && !confirmed) {
      return { status: "NEEDS_CONFIRMATION", tool, call, reason: "Explicit confirmation is required" };
    }
    return { status: "READY", tool, call };
  }

  async execute(
    call: AgentToolCall,
    context: AgentContext,
    options?: { confirmed?: boolean; previewOnly?: boolean },
  ): Promise<AgentExecutionResult> {
    const plan = this.plan(call, context, options?.confirmed === true);
    if (plan.status !== "READY") {
      return {
        status:
          plan.status === "NEEDS_CONFIRMATION"
            ? "NEEDS_CONFIRMATION"
            : plan.status === "DENIED"
              ? "DENIED"
              : "UNKNOWN_TOOL",
        plan,
      };
    }

    const handler = this.handlers.get(call.toolName);
    const result = handler ? await handler(call, context) : { ok: true, deferred: true };

    if (options?.previewOnly || plan.tool?.risk === "DRAFT") {
      return { status: "PREVIEW", plan: { ...plan, preview: result }, result };
    }

    return { status: "EXECUTED", plan, result };
  }
}

export function createDefaultAgentToolRegistry(): AgentToolRegistry {
  return new AgentToolRegistry()
    .register(
      {
        name: "analytics.funnel_summary",
        description: "Resume a jornada comercial e o faturamento atribuido.",
        risk: "READ",
        inputSchema: { period: "string", campaignId: "string?" },
      },
      (call) => ({
        kind: "analytics",
        query: call.input.query ?? call.input.period ?? "7d",
        note: "Consulta tenant-scoped via data plane do shell.",
      }),
    )
    .register(
      {
        name: "crm.leads_search",
        description: "Pesquisar leads dentro do workspace atual.",
        risk: "READ",
        inputSchema: { query: "string", status: "string?" },
      },
      (call) => ({ kind: "crm_search", query: call.input.query ?? "" }),
    )
    .register(
      {
        name: "pages.create_draft",
        description: "Criar um rascunho de landing page.",
        risk: "DRAFT",
        requiredRoles: ["OPERATOR"],
        inputSchema: { brief: "string", offerId: "string?", priceCents: "number?" },
      },
      (call, context) => {
        const brief = String(call.input.brief ?? call.input.query ?? "Nova landing page");
        const slug = brief
          .toLowerCase()
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 60);
        return {
          kind: "landing_draft",
          workspaceId: context.workspaceId,
          slug,
          salesPage: {
            headline: brief,
            subheadline: "Gerado pelo agente Atrako",
            bullets: [],
            faq: [],
          },
          checkout: call.input.priceCents
            ? { provider: "mercado_pago", priceCents: Number(call.input.priceCents) }
            : null,
        };
      },
    )
    .register(
      {
        name: "forms.create_draft",
        description: "Criar um formulario condicional (tipo Typeform) a partir de um brief.",
        risk: "DRAFT",
        requiredRoles: ["OPERATOR"],
        inputSchema: { brief: "string" },
      },
      (call, context) => ({
        kind: "form_draft",
        workspaceId: context.workspaceId,
        brief: String(call.input.brief ?? call.input.query ?? ""),
        status: "DRAFT",
      }),
    )
    .register(
      {
        name: "automations.send_whatsapp",
        description: "Enviar uma mensagem WhatsApp para um segmento aprovado.",
        risk: "EXTERNAL_SIDE_EFFECT",
        requiredRoles: ["ADMIN"],
        inputSchema: { audience: "string", message: "string" },
      },
      (call, context) => ({
        kind: "whatsapp_send",
        workspaceId: context.workspaceId,
        audience: call.input.audience,
        message: call.input.message,
      }),
    )
    .register(
      {
        name: "pages.publish",
        description: "Publicar uma versao aprovada de uma pagina.",
        risk: "EXTERNAL_SIDE_EFFECT",
        requiredRoles: ["ADMIN"],
        inputSchema: { pageId: "string", version: "number" },
      },
      (call, context) => ({
        kind: "page_publish",
        workspaceId: context.workspaceId,
        pageId: call.input.pageId,
        version: call.input.version,
      }),
    )
    .register(
      {
        name: "forms.publish",
        description: "Publicar um formulario condicional aprovado.",
        risk: "EXTERNAL_SIDE_EFFECT",
        requiredRoles: ["ADMIN"],
        inputSchema: { formId: "string" },
      },
      (call, context) => ({
        kind: "form_publish",
        workspaceId: context.workspaceId,
        formId: call.input.formId,
      }),
    );
}
