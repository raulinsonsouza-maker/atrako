import { PrismaClient } from "@prisma/client";
import { fetchCampaignMetrics } from "@/lib/googleAds/googleAdsClient";

const prisma = new PrismaClient();

async function main() {
  const clienteId = process.argv[2];
  if (!clienteId) {
    throw new Error("Uso: npx tsx scripts/debug-google-cliente.ts <clienteId>");
  }

  const conta = await prisma.conta.findFirst({
    where: { clienteId, plataforma: "GOOGLE_ADS" },
  });

  if (!conta?.accountIdPlataforma) {
    console.log(
      JSON.stringify(
        { ok: false, clienteId, error: "Conta GOOGLE_ADS não encontrada ou sem accountIdPlataforma" },
        null,
        2
      )
    );
    return;
  }

  const now = new Date();
  const to = now.toISOString().slice(0, 10);
  const fromDate = new Date(now);
  fromDate.setDate(fromDate.getDate() - 7);
  const from = fromDate.toISOString().slice(0, 10);

  try {
    const rows = await fetchCampaignMetrics(conta.accountIdPlataforma, from, to);
    console.log(
      JSON.stringify(
        {
          ok: true,
          clienteId,
          accountIdPlataforma: conta.accountIdPlataforma,
          rows: rows.length,
          period: { from, to },
        },
        null,
        2
      )
    );
  } catch (e) {
    const err = e as { message?: string; stack?: string };
    console.log(
      JSON.stringify(
        {
          ok: false,
          clienteId,
          accountIdPlataforma: conta.accountIdPlataforma,
          errorType: Object.prototype.toString.call(e),
          message: err?.message ?? String(e),
          raw: e,
        },
        null,
        2
      )
    );
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
