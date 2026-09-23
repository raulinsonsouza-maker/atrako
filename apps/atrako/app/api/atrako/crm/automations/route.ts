import { NextRequest, NextResponse } from "next/server";

import {
  AUTOMATION_TEMPLATES,
  publishCrmAutomation,
  type AutomationKind,
} from "@/lib/atrako/crm-automations";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

const kinds = new Set<AutomationKind>(["welcome", "abandonment", "birthday", "handoff"]);

export async function GET() {
  return NextResponse.json({ templates: AUTOMATION_TEMPLATES, kinds: [...kinds] });
}

export async function POST(request: NextRequest) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (typeof body !== "object" || body === null || Array.isArray(body)) {
    return NextResponse.json({ error: "Invalid body" }, { status: 400 });
  }

  const input = body as Record<string, unknown>;
  const workspaceId = typeof input.workspaceId === "string" ? input.workspaceId : "";
  const kind = typeof input.kind === "string" ? input.kind : "";
  const message =
    typeof input.message === "string" && input.message.trim()
      ? input.message
      : kinds.has(kind as AutomationKind)
        ? AUTOMATION_TEMPLATES[kind as AutomationKind]
        : "";

  if (!workspaceId || !kinds.has(kind as AutomationKind) || !message) {
    return NextResponse.json({ error: "workspaceId, kind and message are required" }, { status: 400 });
  }

  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "Workspace not found" }, { status: 404 });
  }

  const result = await publishCrmAutomation(
    {
      kind: kind as AutomationKind,
      workspaceId,
      contactId: typeof input.contactId === "string" ? input.contactId : undefined,
      leadId: typeof input.leadId === "string" ? input.leadId : undefined,
      phone: typeof input.phone === "string" ? input.phone : undefined,
      templateName: typeof input.templateName === "string" ? input.templateName : undefined,
      conversationId: typeof input.conversationId === "string" ? input.conversationId : undefined,
      message,
      channel: "whatsapp",
    },
    input.confirmed === true,
  );

  return NextResponse.json(result, { status: result.status === "PUBLISHED" ? 202 : 200 });
}
