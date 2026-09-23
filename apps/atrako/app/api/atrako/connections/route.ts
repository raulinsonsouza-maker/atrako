import { NextRequest, NextResponse } from "next/server";
import {
  CONNECTION_PROVIDERS,
  disconnectWorkspaceConnection,
  getWorkspaceConnection,
  isConnectionProvider,
  listWorkspaceConnections,
  upsertWorkspaceConnection,
  type ConnectionProvider,
} from "@/lib/atrako/workspace-connections";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

function isServiceAuthorized(request: NextRequest): boolean {
  const expected = process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() || process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (!expected) return false;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

/** Lista / resolve conexões do workspace. Autorizado por token de serviço OU membership/staff. */
export async function GET(request: NextRequest) {
  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  const provider = request.nextUrl.searchParams.get("provider")?.trim();

  if (!workspaceId) {
    return NextResponse.json({ error: "workspaceId required" }, { status: 400 });
  }

  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const serviceOk = isServiceAuthorized(request);
  if (!serviceOk) {
    const access = await requireWorkspaceAccess(workspaceId, "operate");
    if (!access.ok) return access.response;
  }

  if (provider) {
    if (!isConnectionProvider(provider)) {
      return NextResponse.json({ error: "Invalid provider", providers: CONNECTION_PROVIDERS }, { status: 400 });
    }
    if (!serviceOk) {
      const row = await listWorkspaceConnections(workspaceId);
      const item = row.find((r) => r.provider === provider) ?? null;
      return NextResponse.json({ connection: item });
    }
    const full = await getWorkspaceConnection(workspaceId, provider);
    if (!full) return NextResponse.json({ connection: null });
    return NextResponse.json({
      connection: {
        id: full.id,
        provider: full.provider,
        status: full.status,
        label: full.label,
        metadata: full.metadata,
        credentials: full.credentials,
        lastSyncedAt: full.lastSyncedAt,
      },
    });
  }

  const list = await listWorkspaceConnections(workspaceId);
  return NextResponse.json({
    workspaceId,
    providers: CONNECTION_PROVIDERS,
    connections: list,
  });
}

export async function POST(request: NextRequest) {
  const expected = process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() || process.env.ATRAKO_EVENTS_TOKEN?.trim();
  const serviceOk = expected
    ? request.headers.get("authorization") === `Bearer ${expected}`
    : false;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  const provider = typeof b.provider === "string" ? b.provider : "";
  if (!workspaceId || !isConnectionProvider(provider)) {
    return NextResponse.json({ error: "workspaceId and valid provider required" }, { status: 400 });
  }

  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  if (!serviceOk) {
    const access = await requireWorkspaceAccess(workspaceId, "manage");
    if (!access.ok) return access.response;
  }
  if (b.action === "disconnect") {
    await disconnectWorkspaceConnection(workspaceId, provider as ConnectionProvider);
    return NextResponse.json({ ok: true, disconnected: true });
  }

  const credentials =
    b.credentials && typeof b.credentials === "object" && !Array.isArray(b.credentials)
      ? (b.credentials as Record<string, unknown>)
      : {};
  const metadata =
    b.metadata && typeof b.metadata === "object" && !Array.isArray(b.metadata)
      ? (b.metadata as Record<string, unknown>)
      : null;

  const row = await upsertWorkspaceConnection({
    clienteId: workspaceId,
    provider: provider as ConnectionProvider,
    label: typeof b.label === "string" ? b.label : null,
    credentials,
    metadata,
    status: typeof b.status === "string" ? b.status : "ACTIVE",
  });

  return NextResponse.json({ ok: true, id: row.id });
}
