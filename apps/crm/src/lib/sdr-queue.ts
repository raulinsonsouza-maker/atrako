/**
 * Fila SDR: enfileira job sdr-reply para o worker processar.
 * Usado pelo webhook WhatsApp após salvar mensagem entrante.
 */

import { Queue } from "bullmq";
import Redis from "ioredis";

const SDR_REPLY_QUEUE = "sdr-reply";
const JOB_DELAY_MS = 500;

let redis: Redis | null = null;

function getConnection(): Redis {
  const url = process.env.REDIS_URL;
  if (!url) throw new Error("REDIS_URL não definida.");
  if (!redis) {
    redis = new Redis(url, { maxRetriesPerRequest: null });
  }
  return redis;
}

/**
 * Enfileira um job para o worker responder ao lead via SDR.
 * Delay de 500 ms para dar tempo do commit da mensagem.
 */
export async function addSdrReplyJob(
  tenantId: string,
  conversationId: string,
  leadId: string
): Promise<void> {
  const connection = getConnection();
  const queue = new Queue<{ tenantId: string; conversationId: string; leadId: string }>(SDR_REPLY_QUEUE, {
    connection,
  });
  try {
    await queue.add("reply", { tenantId, conversationId, leadId }, { delay: JOB_DELAY_MS });
  } finally {
    await queue.close();
  }
}
