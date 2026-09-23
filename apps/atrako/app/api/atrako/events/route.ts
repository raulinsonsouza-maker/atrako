import { NextRequest, NextResponse } from "next/server";
import { ATRAKO_EVENT_NAMES, isAtrakoEventName } from "@atrako/events";
import { prisma } from "@/lib/db";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { processAtrakoEventSideEffects } from "@/lib/atrako/event-side-effects";

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function hasValidEventShape(value: unknown): value is Record<string, unknown> {
  if (!isRecord(value)) return false;
  if (typeof value.id !== "string" || value.id.length > 120) return false;
  if (typeof value.name !== "string" || !isAtrakoEventName(value.name)) return false;
  if (value.version !== 1 || typeof value.source !== "string") return false;
  if (typeof value.occurredAt !== "string" || Number.isNaN(Date.parse(value.occurredAt))) return false;
  if (
    typeof value.idempotencyKey !== "string" ||
    value.idempotencyKey.length < 1 ||
    value.idempotencyKey.length > 255
  ) {
    return false;
  }
  if (!isRecord(value.context) || typeof value.context.workspaceId !== "string") return false;
  return isRecord(value.payload);
}

function isAuthorized(request: NextRequest): boolean | null {
  const expected = process.env.ATRAKO_EVENTS_TOKEN?.trim();
  if (!expected) return null;
  return request.headers.get("authorization") === `Bearer ${expected}`;
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    acceptedEvents: ATRAKO_EVENT_NAMES,
    note: "Cliente.id no shell é o workspaceId canônico dos eventos.",
  });
}

export async function POST(request: NextRequest) {
  const authorization = isAuthorized(request);
  if (authorization === null) {
    return NextResponse.json({ error: "Atrako event bridge is not configured" }, { status: 503 });
  }
  if (!authorization) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!isRecord(body) || !Array.isArray(body.events) || body.events.length > 100) {
    return NextResponse.json({ error: "events must be an array with at most 100 items" }, { status: 400 });
  }

  const invalidIndex = body.events.findIndex((event) => !hasValidEventShape(event));
  if (invalidIndex >= 0) {
    return NextResponse.json({ error: "Invalid event", index: invalidIndex }, { status: 400 });
  }

  const events = body.events as Array<Record<string, unknown>>;
  const results = { accepted: 0, duplicates: 0 };

  for (const event of events) {
    const context = event.context as Record<string, unknown>;
    const workspaceId = context.workspaceId as string;
    const idempotencyKey = event.idempotencyKey as string;
    const existing = await prisma.$queryRaw<Array<{ id: string }>>`
      SELECT "id"
      FROM "AtrakoEvent"
      WHERE "clienteId" = ${workspaceId}
        AND "idempotencyKey" = ${idempotencyKey}
      LIMIT 1
    `;

    if (existing.length > 0) {
      results.duplicates++;
      continue;
    }

    const workspace = await findWorkspaceById(workspaceId);
    if (!workspace) {
      return NextResponse.json({ error: "Workspace not found", workspaceId }, { status: 404 });
    }

    await prisma.$transaction(async (tx) => {
      await tx.$executeRaw`
        INSERT INTO "AtrakoEvent"
          ("id", "clienteId", "name", "version", "source", "idempotencyKey", "occurredAt", "traceId", "context", "payload")
        VALUES
          (${event.id as string}, ${workspaceId}, ${event.name as string}, ${event.version as number},
           ${event.source as string}, ${idempotencyKey}, ${new Date(event.occurredAt as string)},
           ${typeof body.traceId === "string" ? body.traceId : null},
           ${JSON.stringify(context)}::jsonb, ${JSON.stringify(event.payload)}::jsonb)
      `;
      await tx.$executeRaw`
        INSERT INTO "AtrakoOutbox" ("id", "clienteId", "eventId", "topic", "payload")
        VALUES (${`${event.id}-outbox`}, ${workspaceId}, ${event.id as string}, ${event.name as string}, ${JSON.stringify(event)}::jsonb)
      `;
    });

    try {
      await processAtrakoEventSideEffects({
        name: event.name as string,
        source: event.source as string,
        idempotencyKey,
        occurredAt: event.occurredAt as string,
        context,
        payload: event.payload as Record<string, unknown>,
      });
    } catch (err) {
      console.warn("[atrako/events] side-effects failed:", err);
    }

    results.accepted++;
  }

  return NextResponse.json({ ok: true, ...results }, { status: 202 });
}
