import { NextRequest, NextResponse } from "next/server";
import { syncMetaCliente, syncMetaTodosClientes } from "@/lib/sync/metaApiSync";

function getToken(request: NextRequest): string | null {
  const header = request.headers.get("x-cron-token");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return request.nextUrl.searchParams.get("token");
}

function validateToken(request: NextRequest): NextResponse | null {
  const token = getToken(request);
  const expected = process.env.SYNC_CRON_TOKEN;
  if (expected && token !== expected) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}

async function runSync(request: NextRequest, clienteId: string | undefined, dateFrom?: string, dateTo?: string) {
  try {
    if (clienteId) {
      const result = await syncMetaCliente(clienteId, { dateFrom, dateTo });
      return NextResponse.json({
        ok: !result.error,
        clienteId,
        daysProcessed: result.daysProcessed,
        creativesProcessed: result.creativesProcessed,
        error: result.error,
      });
    }
    const results = await syncMetaTodosClientes({ dateFrom, dateTo });
    return NextResponse.json({ ok: true, results });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

/** GET: usado pelo Vercel Cron (e outros agendadores). Sem clienteId = sync de todos. */
export async function GET(request: NextRequest) {
  const unauthorized = validateToken(request);
  if (unauthorized) return unauthorized;

  const clienteId = request.nextUrl.searchParams.get("clienteId") ?? undefined;
  const dateFrom = request.nextUrl.searchParams.get("dateFrom") ?? undefined;
  const dateTo = request.nextUrl.searchParams.get("dateTo") ?? undefined;

  return runSync(request, clienteId, dateFrom, dateTo);
}

export async function POST(request: NextRequest) {
  const unauthorized = validateToken(request);
  if (unauthorized) return unauthorized;

  const body = await request.json().catch(() => ({}));
  const clienteId =
    (body?.clienteId ?? request.nextUrl.searchParams.get("clienteId")) as string | undefined;
  const dateFrom = (body?.dateFrom ?? request.nextUrl.searchParams.get("dateFrom")) as string | undefined;
  const dateTo = (body?.dateTo ?? request.nextUrl.searchParams.get("dateTo")) as string | undefined;

  return runSync(request, clienteId, dateFrom, dateTo);
}
