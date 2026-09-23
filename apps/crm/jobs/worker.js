/**
 * BullMQ worker – processa fila sdr-reply (resposta automática do SDR ao WhatsApp).
 */
if (!process.env.REDIS_URL) {
  console.warn("REDIS_URL não definida. Worker encerrado.");
  process.exit(0);
}

const { Worker } = require("bullmq");
const Redis = require("ioredis");

const connection = new Redis(process.env.REDIS_URL, { maxRetriesPerRequest: null });

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || process.env.APP_URL || "http://localhost:3000";
const INTERNAL_KEY = process.env.INTERNAL_API_KEY || process.env.CRON_SECRET;

async function processSdrReplyJob(job) {
  const { tenantId, conversationId, leadId } = job.data;
  const url = `${APP_URL.replace(/\/$/, "")}/api/internal/sdr-reply`;
  const headers = { "Content-Type": "application/json" };
  if (INTERNAL_KEY) headers["X-Internal-Key"] = INTERNAL_KEY;
  const res = await fetch(url, {
    method: "POST",
    headers,
    body: JSON.stringify({ tenantId, conversationId, leadId }),
  });
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`sdr-reply API ${res.status}: ${text}`);
  }
}

async function main() {
  const worker = new Worker(
    "sdr-reply",
    async (job) => {
      await processSdrReplyJob(job);
    },
    { connection }
  );
  worker.on("completed", (job) => {
    console.log("[worker] sdr-reply job completed:", job.id);
  });
  worker.on("failed", (job, err) => {
    console.error("[worker] sdr-reply job failed:", job?.id, err?.message || err);
  });
  console.log("CRM worker running. Queue: sdr-reply.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
