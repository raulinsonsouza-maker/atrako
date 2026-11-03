/**
 * Relatório de presença GEO (franquia): hits + prompts + páginas publicadas.
 * Roda no container: node /tmp/geo-franchise-report.mjs
 */
import { createRequire } from "node:module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("/app/lib/generated/prisma");
const p = new PrismaClient();

const HOST = "lp.regicenter.com";

async function main() {
  const site = await p.geoSite.findUnique({ where: { host: HOST } });
  if (!site) throw new Error("site missing");

  const published = await p.geoPage.count({ where: { siteId: site.id, status: "PUBLISHED" } });
  const archived = await p.geoPage.count({ where: { siteId: site.id, status: "ARCHIVED" } });
  const prompts = await p.geoPrompt.count({ where: { siteId: site.id, active: true } });

  const since = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
  const hits = await p.geoHit.groupBy({
    by: ["kind"],
    where: { host: HOST, createdAt: { gte: since } },
    _count: { _all: true },
  });

  const topPaths = await p.$queryRawUnsafe(
    `SELECT path, kind, COUNT(*)::int AS n
     FROM "GeoHit"
     WHERE host = $1 AND "createdAt" >= $2
     GROUP BY path, kind
     ORDER BY n DESC
     LIMIT 25`,
    HOST,
    since,
  );

  // Leads com geoPage no metadata (últimos 30d) — NativeLead.metadata JSON
  let leadsGeo = [];
  try {
    leadsGeo = await p.$queryRawUnsafe(
      `SELECT
         metadata->>'geoPage' AS "geoPage",
         metadata->>'geoPageTitle' AS "geoPageTitle",
         metadata->>'aiSource' AS "aiSource",
         COUNT(*)::int AS n
       FROM "NativeLead"
       WHERE "clienteId" = $1
         AND "createdAt" >= $2
         AND (metadata ? 'geoPage' OR metadata ? 'aiSource')
       GROUP BY 1, 2, 3
       ORDER BY n DESC
       LIMIT 30`,
      site.clienteId,
      since,
    );
  } catch (e) {
    console.warn("[leads]", e instanceof Error ? e.message : e);
  }

  const franchisePages = await p.geoPage.findMany({
    where: {
      siteId: site.id,
      status: "PUBLISHED",
      OR: [
        { slug: { contains: "franquia" } },
        { hub: { slug: { in: ["franquia-regicenter", "escolher-franquia", "perfis", "regioes"] } } },
      ],
    },
    select: { slug: true, title: true, hub: { select: { slug: true } } },
    orderBy: { updatedAt: "desc" },
    take: 40,
  });

  const out = {
    host: HOST,
    windowDays: 30,
    pages: { published, archived },
    promptsActive: prompts,
    hitsByKind: hits.map((h) => ({ kind: h.kind, count: h._count._all })),
    topPaths,
    leadsFromGeo: leadsGeo,
    franchisePages: franchisePages.map((x) => `${x.hub.slug}/${x.slug}`),
  };
  console.log(JSON.stringify(out, null, 2));
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => p.$disconnect());
