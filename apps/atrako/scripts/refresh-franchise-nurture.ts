/**
 * Reescreve os e-mails da nutrição que ainda não foram editados à mão.
 *
 *   npx tsx scripts/refresh-franchise-nurture.ts --print
 *   npx tsx scripts/refresh-franchise-nurture.ts regicenter
 */
import { config } from "dotenv";

config();
config({ path: ".env.local", override: true });

async function main() {
  const arg = process.argv[2]?.trim() || "regicenter";
  const { FRANCHISE_NURTURE } = await import("../lib/flows/playbooks-franchise");
  if (arg === "--print") {
    const steps = FRANCHISE_NURTURE.steps.map((step) => ({
      copyKey: step.copyKey,
      content: step.email!("proximo"),
    }));
    const json = JSON.stringify(steps);
    const out = process.argv[3]?.trim();
    if (out) {
      const { writeFileSync } = await import("node:fs");
      writeFileSync(out, json);
      console.log(JSON.stringify({ ok: true, bytes: Buffer.byteLength(json), steps: steps.length, out }));
    } else {
      process.stdout.write(json);
    }
    return;
  }

  const { prisma } = await import("../lib/db");
  const { refreshFlowCopy } = await import("../lib/flows/playbooks");
  const cliente = await prisma.cliente.findFirst({
    where: { OR: [{ slug: arg }, { nome: { contains: arg, mode: "insensitive" } }] },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) {
    console.log(JSON.stringify({ ok: false, reason: "workspace nao encontrado", slug: arg }));
    await prisma.$disconnect();
    process.exit(1);
  }
  const result = await refreshFlowCopy(cliente.id, "franchise_nurture");
  console.log(JSON.stringify({ ok: true, nome: cliente.nome, slug: cliente.slug, ...result }));
  await prisma.$disconnect();
}

main().catch((err) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
