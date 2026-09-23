import { NextRequest, NextResponse } from "next/server";
import { runDailyAlerts } from "@/lib/alerts/sendAlerts";

function getCronToken(request: NextRequest): string | null {
  const header = request.headers.get("x-cron-token");
  if (header) return header;
  const auth = request.headers.get("authorization");
  if (auth?.startsWith("Bearer ")) return auth.slice(7);
  return null;
}

function isAuthorized(request: NextRequest): boolean {
  const cronToken = getCronToken(request);
  const adminToken =
    request.headers.get("x-admin-token") ??
    request.nextUrl.searchParams.get("token");

  const expectedCronToken = process.env.SYNC_CRON_TOKEN;
  const expectedAdminToken = process.env.ADMIN_SECRET;

  if (!expectedCronToken && !expectedAdminToken) return true;

  if (expectedCronToken && cronToken === expectedCronToken) return true;

  if (expectedAdminToken && adminToken === expectedAdminToken) return true;

  return false;
}

/** GET: called by Vercel Cron daily, or manually from admin panel. */
export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const result = await runDailyAlerts();
    return NextResponse.json({
      ok: true,
      saldosBaixosCount: result.saldosBaixos.length,
      anomaliasCount: result.anomalias.length,
      emailEnviado: result.emailEnviado,
      webhookEnviado: result.webhookEnviado,
      erros: result.erros,
      saldosBaixos: result.saldosBaixos,
      anomalias: result.anomalias,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
