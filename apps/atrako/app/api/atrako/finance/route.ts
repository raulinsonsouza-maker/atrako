import { NextRequest, NextResponse } from "next/server";
import { listLedgerEntries, summarizeLedger, upsertLedgerEntry } from "@/lib/atrako/finance-ledger";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

function isAuthorized(request: NextRequest): boolean {
  const expected = process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() || process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (expected && request.headers.get("authorization") === `Bearer ${expected}`) return true;
  // UI shell: allow without token for local open access
  return true;
}

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const workspaceId = request.nextUrl.searchParams.get("workspaceId")?.trim();
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const source = request.nextUrl.searchParams.get("source")?.trim() || undefined;
  const fromRaw = request.nextUrl.searchParams.get("from");
  const toRaw = request.nextUrl.searchParams.get("to");
  const from = fromRaw ? new Date(fromRaw) : undefined;
  const to = toRaw ? new Date(toRaw) : undefined;

  const [summary, entries] = await Promise.all([
    summarizeLedger(workspaceId, from, to),
    listLedgerEntries({ clienteId: workspaceId, from, to, source, take: 200 }),
  ]);

  return NextResponse.json({
    workspaceId,
    summary,
    entries: entries.map((e) => ({
      id: e.id,
      type: e.type,
      amount: Number(e.amount),
      currency: e.currency,
      status: e.status,
      occurredAt: e.occurredAt.toISOString(),
      source: e.source,
      sourceRef: e.sourceRef,
      provider: e.provider,
      description: e.description,
      leadId: e.leadId,
      contact: e.contact,
      metadata:
        e.metadata && typeof e.metadata === "object" && !Array.isArray(e.metadata)
          ? (e.metadata as Record<string, unknown>)
          : null,
      pageSlug:
        e.metadata &&
        typeof e.metadata === "object" &&
        !Array.isArray(e.metadata) &&
        typeof (e.metadata as Record<string, unknown>).pageSlug === "string"
          ? String((e.metadata as Record<string, unknown>).pageSlug)
          : null,
      formName:
        e.metadata &&
        typeof e.metadata === "object" &&
        !Array.isArray(e.metadata) &&
        (typeof (e.metadata as Record<string, unknown>).formName === "string" ||
          typeof (e.metadata as Record<string, unknown>).formSlug === "string")
          ? String(
              (e.metadata as Record<string, unknown>).formName ||
                (e.metadata as Record<string, unknown>).formSlug,
            )
          : null,
    })),
  });
}

export async function POST(request: NextRequest) {
  // UI shell + service token: open local for admin UI; token when configured for services
  const expected = process.env.ATRAKO_CONNECTIONS_TOKEN?.trim() || process.env.ATRAKO_EVENTS_TOKEN?.trim();
  const bearer = request.headers.get("authorization");
  if (expected && bearer && bearer !== `Bearer ${expected}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const b = body as Record<string, unknown>;
  const workspaceId = typeof b.workspaceId === "string" ? b.workspaceId : "";
  if (!workspaceId) return NextResponse.json({ error: "workspaceId required" }, { status: 400 });

  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Workspace not found" }, { status: 404 });

  const amount = typeof b.amount === "number" ? b.amount : Number(b.amount);
  if (!Number.isFinite(amount)) return NextResponse.json({ error: "amount required" }, { status: 400 });

  const type = b.type === "EXPENSE" || b.type === "REFUND" ? b.type : "INCOME";
  const idempotencyKey =
    typeof b.idempotencyKey === "string" && b.idempotencyKey
      ? b.idempotencyKey
      : `manual:${workspaceId}:${Date.now()}`;

  const entry = await upsertLedgerEntry({
    clienteId: workspaceId,
    type,
    amount,
    occurredAt: b.occurredAt ? new Date(String(b.occurredAt)) : new Date(),
    source: typeof b.source === "string" ? b.source : "manual",
    sourceRef: typeof b.sourceRef === "string" ? b.sourceRef : null,
    idempotencyKey,
    description: typeof b.description === "string" ? b.description : "Lançamento manual",
    provider: typeof b.provider === "string" ? b.provider : "MANUAL",
    status: "CONFIRMED",
  });

  return NextResponse.json({ ok: true, id: entry.id }, { status: 201 });
}
