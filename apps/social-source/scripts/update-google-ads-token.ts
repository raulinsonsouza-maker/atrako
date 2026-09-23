/**
 * Atualiza o refresh token do Google Ads no SystemConfig (banco de dados).
 * Uso: npx tsx scripts/update-google-ads-token.ts
 * Token: passe via GOOGLE_ADS_REFRESH_TOKEN ou argv[2] — nunca hardcode no repo.
 */
import { updateIntegrationsConfig } from "@/lib/config/integrations";

const REFRESH_TOKEN =
  process.env.GOOGLE_ADS_REFRESH_TOKEN?.trim() || process.argv[2]?.trim() || "";

async function main() {
  if (!REFRESH_TOKEN) {
    console.error(
      "Informe o token: GOOGLE_ADS_REFRESH_TOKEN=... npx tsx scripts/update-google-ads-token.ts",
    );
    process.exit(1);
  }
  await updateIntegrationsConfig({ googleRefreshToken: REFRESH_TOKEN });
  console.log("✓ Refresh token do Google Ads atualizado no banco de dados.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
