/**
 * One-shot: ensureDefaultFlows no workspace Stresser (liga paid.thanks).
 *   npx tsx scripts/enable-stresser-paid-thanks.ts
 */
import { prisma } from "../lib/db";
import { ensureDefaultFlows } from "../lib/flows/playbooks";

async function main() {
  const c = await prisma.cliente.findFirst({
    where: { slug: "stresser" },
    select: { id: true },
  });
  if (!c) throw new Error("Workspace stresser não encontrado");
  const flows = await ensureDefaultFlows(c.id);
  const step = await prisma.messageFlowStep.findFirst({
    where: { copyKey: "paid.thanks", flow: { clienteId: c.id, key: "order_paid" } },
    select: { enabled: true, delayMinutes: true, id: true },
  });
  console.log(JSON.stringify({ workspaceId: c.id, flows, paidThanks: step }, null, 2));
}

main()
  .catch((err) => {
    console.error(err instanceof Error ? err.message : err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
