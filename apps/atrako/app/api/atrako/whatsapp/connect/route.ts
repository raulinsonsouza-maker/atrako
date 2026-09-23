import { NextRequest, NextResponse } from "next/server";
import { requireInternalAnalyst } from "@/lib/internalAccess";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import {
  disconnectWorkspaceConnection,
  upsertWorkspaceConnection,
} from "@/lib/atrako/workspace-connections";

/** Conectar / desconectar WhatsApp Cloud API via sessão admin (Config). */
export async function POST(request: NextRequest) {
  const auth = await requireInternalAnalyst();
  if (auth.response) return auth.response;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId || !(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  if (b.action === "disconnect") {
    await disconnectWorkspaceConnection(workspaceId, "WHATSAPP");
    return NextResponse.json({ ok: true, disconnected: true });
  }

  const credentials =
    b.credentials && typeof b.credentials === "object" && !Array.isArray(b.credentials)
      ? (b.credentials as Record<string, unknown>)
      : {};
  const accessToken = typeof credentials.accessToken === "string" ? credentials.accessToken : "";
  const phoneNumberId =
    typeof credentials.phoneNumberId === "string" ? credentials.phoneNumberId : "";
  if (!accessToken || !phoneNumberId) {
    return NextResponse.json(
      { error: "accessToken e phoneNumberId são obrigatórios" },
      { status: 400 },
    );
  }

  const metadata =
    b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : { phoneNumberId };

  const row = await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: "WHATSAPP",
    label: typeof b.label === "string" ? b.label : "WhatsApp Cloud API",
    credentials,
    metadata: { ...metadata, phoneNumberId },
    status: "ACTIVE",
  });

  return NextResponse.json({ ok: true, id: row.id });
}
