/**
 * Seed Regicenter — Fase 1.
 * Cria o GeoSite, hubs, prompts e ~50 páginas PUBLISHED.
 * 
 * Execução: `npx tsx scripts/seed-regicenter.ts --workspace regicenter`
 * 
 * Este script:
   1. Cria/atualiza o GeoSite (host lp.regicenter.com, facts publicáveis apenas).
   2. Cria 3 hubs: franquia-regicenter, escolher-franquia, perfis.
   3. Cria prompts-alvo para cada hub.
   4. Gera ~50 páginas guide/faq/profile distribuídas pelos hubs.
   5. Define status PUBLISHED (pronto para indexação).
   6. Exporta resumo no console.
 */

import "server-only";
import { PrismaClient } from "@prisma/cient";
import { createGeoSite, createHubs, createPrompts, createPages } from "./seed-lib";

const args = process.argv.slice(2);
const workspace = args.find((a) => a.startsWith("--workspace="))?.split("=")[1] ?? "regicenter";

async function main() {
  const p = new PrismaClient({ log: ["query", "error"] });

  try {
    console.log(`[seed] Iniciando seed para workspace: ${workspace}`);

    // 1. GeoSite
    const site = await createGeoSite(p, workspace);
    console.log(`[seed] GeoSite ${site.id} (host: ${site.host}) criado.`);

    // 2. Hubs
    const hubs = await createHubs(p, site.id);
    console.log(`[seed] ${hubs.length} hubs criados.`);

    // 3. Prompts
    await createPrompts(p, hubs);
    console.log("[seed] Prompts criados.");

    // 4. Páginas (~50)
    const totalPages = await createPages(p, site.id, hubs);
    console.log(`[seed] ${totalPages} páginas criadas com status PUBLISHED.`);

    // 5. Resumo
    const published = await prisma.geoPage.count({ where: { siteId: site.id, status: "PUBLISHED" } });
    const total = await prisma.geoPage.count({ where: { siteId: site.id } });
    console.log(`[seed] Resumo: PUBLISHED=${published} / total=${total}`);

    console.log("[seed] Concluído. Execute o monitor para medir baseline de citações.");
  } catch (err) {
    console.error("[seed] Erro fatal:", err instanceof Error ? err.message : err);
    process.exit(1);
  } finally {
    await p.$disconnect();
  }
}

main();