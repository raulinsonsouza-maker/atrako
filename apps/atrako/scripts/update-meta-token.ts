/**
 * Script para atualizar o token de acesso do Meta no banco.
 * Uso: META_ACCESS_TOKEN=<token> npx tsx scripts/update-meta-token.ts
 *   ou: npx tsx scripts/update-meta-token.ts <token>
 */

import { updateIntegrationsConfig } from "../lib/config/integrations";

async function main() {
  const token = process.argv[2] ?? process.env.META_ACCESS_TOKEN;
  if (!token?.trim()) {
    console.error("Forneça o token: META_ACCESS_TOKEN=<token> npx tsx scripts/update-meta-token.ts");
    process.exit(1);
  }
  await updateIntegrationsConfig({ metaAccessToken: token.trim() });
  console.log("Token Meta atualizado com sucesso.");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
