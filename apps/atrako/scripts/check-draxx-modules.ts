import { prisma } from "../lib/db";
import {
  MODULES,
  readExplicitModules,
  resolveModuleState,
  type ModuleRelease,
} from "../lib/modules/registry";

async function main() {
  const cliente = await prisma.cliente.findUnique({ where: { slug: "draxx" } });
  if (!cliente) throw new Error("no draxx");
  const settings = await prisma.workspaceSettings.findUnique({
    where: { clienteId: cliente.id },
  });
  const releases = Object.fromEntries(
    (
      await prisma.platformModule.findMany().catch(() => [] as { key: string; release: string }[])
    ).map((r) => [r.key, r.release]),
  );
  const explicit = readExplicitModules(settings?.modulesEnabled);
  const commerce = MODULES.find((m) => m.key === "commerce")!;
  const release = (releases.commerce as ModuleRelease) || commerce.defaultRelease;
  const state = resolveModuleState(commerce, release, explicit.commerce, false);
  console.log(
    JSON.stringify(
      {
        edition: settings?.edition,
        modulesEnabled: settings?.modulesEnabled,
        commerceRelease: release,
        commerceState: state,
        explicitCommerce: explicit.commerce,
      },
      null,
      2,
    ),
  );
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
