/**
 * Jobs agendados dos fluxos (chamados por /api/atrako/flows/cron via crontab da VPS).
 * Cada execução registra JobRun — saúde dos crons na Visão geral e no sino.
 */

import { prisma } from "@/lib/db";
import { runDueSteps } from "@/lib/flows/engine";
import { syncAllResendWorkspaces } from "@/lib/flows/resend-sync";

export const JOB_NAMES = ["flows.steps", "flows.hourly", "flows.profiles"] as const;
export type JobName = (typeof JOB_NAMES)[number];

/** Intervalo esperado (min) — acima disso + folga gera aviso de cron parado. */
export const JOB_EXPECTED_MINUTES: Record<JobName, number> = {
  "flows.steps": 5,
  "flows.hourly": 60,
  "flows.profiles": 24 * 60,
};

export async function withJobRun<T extends object>(job: string, fn: () => Promise<T>): Promise<T> {
  const run = await prisma.jobRun.create({ data: { job } });
  try {
    const stats = await fn();
    await prisma.jobRun.update({
      where: { id: run.id },
      data: { finishedAt: new Date(), ok: true, stats: JSON.parse(JSON.stringify(stats)) },
    });
    return stats;
  } catch (err) {
    await prisma.jobRun.update({
      where: { id: run.id },
      data: {
        finishedAt: new Date(),
        ok: false,
        error: (err instanceof Error ? err.stack || err.message : String(err)).slice(0, 4000),
      },
    });
    throw err;
  }
}

/** A cada 5 min: passos vencidos + campanhas agendadas (em lotes com lease). */
export async function runStepsJob() {
  return withJobRun("flows.steps", async () => {
    const started = Date.now();
    const totals = { claimed: 0, sent: 0, skipped: 0, deferred: 0, completed: 0, exited: 0, failed: 0 };
    while (Date.now() - started < 4 * 60_000) {
      const r = await runDueSteps({ limit: 200 });
      for (const k of Object.keys(totals) as Array<keyof typeof totals>) totals[k] += r[k];
      if (r.claimed < 200) break;
    }
    const { runDueCampaigns } = await import("@/lib/flows/campaigns");
    const campaigns = await runDueCampaigns();
    // Quem vigia o job de hora em hora (que vigia os demais) é o de 5 min.
    const { alertStaleJobs } = await import("@/lib/notifications/reminders");
    await alertStaleJobs(new Date(), ["flows.hourly"]).catch(() => []);
    return { ...totals, campaigns };
  });
}

/** De hora em hora: sync Resend, datas (aniversários/sazonais), lembretes, saúde. */
export async function runHourlyJob() {
  return withJobRun("flows.hourly", async () => {
    const resend = await syncAllResendWorkspaces().catch((e: unknown) => ({ error: String(e) }));
    const { runDateTriggers } = await import("@/lib/flows/important-dates");
    const dates = await runDateTriggers().catch((e) => ({ error: String(e) }));
    const { createSeasonalCampaigns } = await import("@/lib/flows/campaigns");
    const seasonal = await createSeasonalCampaigns().catch((e) => ({ error: String(e) }));
    const { runCampaignReminders, runHealthChecks } = await import("@/lib/notifications/reminders");
    const reminders = await runCampaignReminders().catch((e) => ({ error: String(e) }));
    const health = await runHealthChecks().catch((e) => ({ error: String(e) }));
    const { refreshAllWaAccounts } = await import("@/lib/flows/wa-sync");
    const wa = await refreshAllWaAccounts().catch((e) => ({ error: String(e) }));
    return { resend: Object.keys(resend).length, dates, seasonal, reminders, health, wa };
  });
}

/** Noturno: CustomerProfile + recompra / win-back / segunda compra. */
export async function runProfilesJob() {
  return withJobRun("flows.profiles", async () => {
    const { recomputeAllProfiles } = await import("@/lib/flows/profile");
    return recomputeAllProfiles();
  });
}

export async function jobHealth() {
  const out: Array<{ job: string; lastAt: Date | null; ok: boolean | null; stale: boolean; recentFailures: number }> = [];
  for (const job of JOB_NAMES) {
    const runs = await prisma.jobRun.findMany({
      where: { job },
      orderBy: { startedAt: "desc" },
      take: 3,
      select: { startedAt: true, ok: true },
    });
    const last = runs[0];
    const expected = JOB_EXPECTED_MINUTES[job];
    const stale = !last || Date.now() - last.startedAt.getTime() > (expected + 30) * 60_000;
    out.push({
      job,
      lastAt: last?.startedAt ?? null,
      ok: last?.ok ?? null,
      stale,
      recentFailures: runs.filter((r) => r.ok === false).length,
    });
  }
  return out;
}
