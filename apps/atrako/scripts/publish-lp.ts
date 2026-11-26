/**
 * Publica pacote `lp-pages/{slug}` no DB (salesPage v3) + assets em lp-media.
 * Sem rebuild Docker.
 *
 *   npx tsx scripts/publish-lp.ts pikolin-mood
 *   npx tsx scripts/publish-lp.ts --list
 */
import { listLpPageSlugs } from "../lib/lp-pages/load-package";
import { publishLpPackage } from "../lib/lp-pages/publish";
import { MAX_LP_CSS, MAX_LP_HTML } from "../lib/criar/lp-html";

async function main() {
  const arg = process.argv[2]?.trim();
  if (!arg || arg === "--list") {
    const slugs = listLpPageSlugs();
    console.log(slugs.length ? `Pacotes:\n- ${slugs.join("\n- ")}` : "Nenhum pacote em lp-pages/");
    return;
  }

  const result = await publishLpPackage(arg);
  console.log(
    JSON.stringify(
      {
        ok: true,
        productId: result.productId,
        productSlug: result.productSlug,
        packageSlug: result.packageSlug,
        assetsCopied: result.assetsCopied.length,
        htmlBytes: result.htmlBytes,
        cssBytes: result.cssBytes,
        limits: { MAX_LP_HTML, MAX_LP_CSS },
        underLimits: result.htmlBytes <= MAX_LP_HTML && result.cssBytes <= MAX_LP_CSS,
      },
      null,
      2,
    ),
  );

  if (result.htmlBytes > MAX_LP_HTML || result.cssBytes > MAX_LP_CSS) {
    console.error("AVISO: pacote excede limites MAX_LP_* (foi truncado no buildSalesPageV3).");
    process.exitCode = 2;
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
