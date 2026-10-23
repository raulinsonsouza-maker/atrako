import "server-only";
import { randomBytes } from "node:crypto";
import { prisma } from "@/lib/db";
import { siteOrigin } from "./site";

/** Garante a chave IndexNow do site (servida em `/indexnow.txt`). */
export async function ensureIndexNowKey(site: { id: string; indexNowKey: string | null }) {
  if (site.indexNowKey) return site.indexNowKey;
  const key = randomBytes(16).toString("hex");
  await prisma.geoSite.update({ where: { id: site.id }, data: { indexNowKey: key } });
  return key;
}

/**
 * Avisa Bing/Yandex/Seznam (e o Copilot, que usa o índice do Bing) que as URLs mudaram.
 * Só roda em produção: a verificação busca `https://{host}/indexnow.txt`.
 */
export async function submitIndexNow(
  site: { id: string; host: string; indexNowKey: string | null },
  urls: string[],
): Promise<{ ok: boolean; status?: number; skipped?: string }> {
  if (!urls.length) return { ok: true, skipped: "sem URLs" };
  if (process.env.NODE_ENV !== "production") return { ok: true, skipped: "fora de produção" };
  const key = await ensureIndexNowKey(site);
  try {
    const res = await fetch("https://api.indexnow.org/indexnow", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify({
        host: site.host,
        key,
        keyLocation: `${siteOrigin(site)}/indexnow.txt`,
        urlList: urls.slice(0, 10000),
      }),
      signal: AbortSignal.timeout(10_000),
    });
    return { ok: res.ok, status: res.status };
  } catch (err) {
    console.warn("[geo] indexnow", err instanceof Error ? err.message : err);
    return { ok: false };
  }
}
