/**
 * Logger centralizado que persiste entradas no banco (SyncLog) e também
 * emite para o console. Usado pelos syncs e pelo Telegram para que erros
 * fiquem visíveis no painel admin em produção.
 */
import { prisma } from "@/lib/db";

type LogLevel = "INFO" | "WARN" | "ERROR";
type Context = Record<string, unknown> | null | undefined;

async function writeLog(level: LogLevel, message: string, context?: Context) {
  // Console sempre (para logs do servidor / deployment logs)
  const prefix = `[${new Date().toISOString()}] [${level}]`;
  if (level === "ERROR") {
    console.error(`${prefix} ${message}`, context ?? "");
  } else if (level === "WARN") {
    console.warn(`${prefix} ${message}`, context ?? "");
  } else {
    console.log(`${prefix} ${message}`, context ?? "");
  }

  // Banco — fire-and-forget (não bloqueia o sync se o DB estiver fora)
  try {
    await prisma.syncLog.create({
      data: {
        level,
        message,
        // Prisma Json field requires explicit cast via JSON round-trip
        ...(context != null ? { context: JSON.parse(JSON.stringify(context)) } : {}),
      },
    });
  } catch {
    // Silencioso: não queremos que uma falha de log interrompa o sync
  }
}

export function logInfo(message: string, context?: Context) {
  return writeLog("INFO", message, context);
}

export function logWarn(message: string, context?: Context) {
  return writeLog("WARN", message, context);
}

export function logError(message: string, context?: Context) {
  return writeLog("ERROR", message, context);
}

/**
 * Remove entradas com mais de `days` dias (padrão: 7).
 * Chamado pela API de leitura de logs para manter o banco enxuto.
 */
export async function purgeLogs(days = 7) {
  const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  try {
    await prisma.syncLog.deleteMany({ where: { createdAt: { lt: cutoff } } });
  } catch {
    // Silencioso
  }
}
