/**
 * Cron dos fluxos de relacionamento.
 *   ?job=steps    a cada 5 min — passos vencidos + campanhas agendadas
 *   ?job=hourly   de hora em hora — sync Resend, datas, lembretes, saúde
 *   ?job=profiles noturno — CustomerProfile + recompra/win-back
 * Auth: Bearer CRON_SECRET ou ?secret=CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { runHourlyJob, runProfilesJob, runStepsJob } from "@/lib/flows/jobs";

export const maxDuration = 300;

function authorized(request: NextRequest) {
  const expected = process.env.CRON_SECRET?.trim();
  if (!expected) return process.env.NODE_ENV !== "production";
  const bearer = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  return request.nextUrl.searchParams.get("secret") === expected || bearer === expected;
}

export async function GET(request: NextRequest) {
  if (!authorized(request)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const job = request.nextUrl.searchParams.get("job") ?? "steps";
  try {
    const result =
      job === "hourly" ? await runHourlyJob() : job === "profiles" ? await runProfilesJob() : await runStepsJob();
    return NextResponse.json({ ok: true, job, result });
  } catch (err) {
    return NextResponse.json(
      { ok: false, job, error: err instanceof Error ? err.message : String(err) },
      { status: 500 },
    );
  }
}

export const POST = GET;
