import { PrismaClient } from "../lib/generated/prisma";

const prisma = new PrismaClient();

type AccountSeed = {
  clienteNome: string;
  accountId: string;
  plataforma: "GOOGLE_ADS" | "META";
  slugSugerido?: string;
};

const googleAccounts: AccountSeed[] = [
  { clienteNome: "Lounge 161", accountId: "299-043-1301", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Agromee 247", accountId: "641-899-5903", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Ah!natu", accountId: "146-624-6674", plataforma: "GOOGLE_ADS" },
  { clienteNome: "BELLA CASA - ADS", accountId: "307-163-0927", plataforma: "GOOGLE_ADS" },
  { clienteNome: "BeBlue School", accountId: "226-572-6531", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Bobinauto", accountId: "863-707-2952", plataforma: "GOOGLE_ADS" },
  { clienteNome: "COMERCIO DE MELAÇO DE CANA ECL EIRELI", accountId: "733-728-5470", plataforma: "GOOGLE_ADS" },
  { clienteNome: "CleanPack", accountId: "373-577-6199", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Clínica & Spa Vida Natural", accountId: "977-000-0305", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Dr. Fernando Guena Camargo", accountId: "896-137-5756", plataforma: "GOOGLE_ADS" },
  { clienteNome: "ESALQ JR 2", accountId: "845-973-1272", plataforma: "GOOGLE_ADS" },
  { clienteNome: "ESALQ Jr. Consultoria", accountId: "403-651-3276", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Estate Brazil", accountId: "731-685-6552", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Fani Metais", accountId: "725-063-0500", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Florien - Google ads", accountId: "643-279-9178", plataforma: "GOOGLE_ADS" },
  { clienteNome: "GRANAROLO SPACCIO - Tatiana Jones", accountId: "527-673-5712", plataforma: "GOOGLE_ADS" },
  { clienteNome: "IOA Piracicaba", accountId: "125-125-7595", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Imobiliaria Barros", accountId: "321-720-6797", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Inout ADS - (Nova)", accountId: "184-044-6897", plataforma: "GOOGLE_ADS" },
  { clienteNome: "JR ODONTO TAKAKI", accountId: "418-724-3231", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Kairalla Imóveis", accountId: "285-355-3843", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Kalili Imóveis", accountId: "831-842-9497", plataforma: "GOOGLE_ADS" },
  { clienteNome: "KiDi+", accountId: "223-940-0890", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Kombucha da Cá", accountId: "387-988-6041", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Liteq ADS", accountId: "138-713-1095", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Marth Consultoria Imobiliária", accountId: "513-321-5672", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Med & Lar", accountId: "577-782-8572", plataforma: "GOOGLE_ADS" },
  { clienteNome: "MepCred", accountId: "174-007-2841", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Miguel Imóveis ADS", accountId: "621-726-6084", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Mirante", accountId: "551-423-1739", plataforma: "GOOGLE_ADS" },
  { clienteNome: "More Imobiliária", accountId: "306-085-5595", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Namastê", accountId: "522-336-9602", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Nut Sense", accountId: "169-129-5772", plataforma: "GOOGLE_ADS" },
  { clienteNome: "PEU", accountId: "544-256-0888", plataforma: "GOOGLE_ADS" },
  { clienteNome: "PR COMPRESSORES", accountId: "355-385-7347", plataforma: "GOOGLE_ADS" },
  { clienteNome: "PV BOX", accountId: "103-036-6723", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Parque dos Ipês", accountId: "244-188-2056", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Peecock", accountId: "639-696-7854", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Piratruck", accountId: "870-714-5362", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Pousada Ilha Brazil", accountId: "369-513-5192", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Resort Fazenda São João", accountId: "350-050-6795", plataforma: "GOOGLE_ADS" },
  { clienteNome: "SAMMIX", accountId: "525-757-8684", plataforma: "GOOGLE_ADS" },
  { clienteNome: "SR Advogados", accountId: "627-216-9597", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Sou+ Charitas", accountId: "522-015-1031", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Sou+ Icaraí", accountId: "203-599-7294", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Sou+ Itacoa", accountId: "719-002-2484", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Sou+Wellness Charitas", accountId: "641-932-0082", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Terra dos Grãos", accountId: "352-626-5829", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Varella Motos", accountId: "773-251-1577", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Vertigarden", accountId: "271-531-6643", plataforma: "GOOGLE_ADS" },
  { clienteNome: "YOUFIT PIRACICABA", accountId: "885-160-6795", plataforma: "GOOGLE_ADS" },
  { clienteNome: "[B16] - Gigante Colchões/SP", accountId: "978-512-0892", plataforma: "GOOGLE_ADS" },
  { clienteNome: "[PME] Wizie Pet", accountId: "270-884-0319", plataforma: "GOOGLE_ADS" },
  { clienteNome: "Ânkora Incorporadora", accountId: "728-960-3198", plataforma: "GOOGLE_ADS" },
];

const metaAccounts: AccountSeed[] = [
  { clienteNome: "Conta Hotel (Resort Fazenda São João)", accountId: "320901911416777", plataforma: "META", slugSugerido: "hotel-fazenda-sao-joao" },
  { clienteNome: "Tertúlia", accountId: "2260546050901858", plataforma: "META", slugSugerido: "tertulia" },
  { clienteNome: "Varella Motos", accountId: "867689343316284", plataforma: "META", slugSugerido: "varella-motos" },
  { clienteNome: "ESALQ Jr. Consultoria", accountId: "237828749660910", plataforma: "META", slugSugerido: "esalq-jr" },
  { clienteNome: "Academy Americana", accountId: "873760468896822", plataforma: "META", slugSugerido: "academy-americana" },
  { clienteNome: "Be Blue School", accountId: "205900210846295", plataforma: "META", slugSugerido: "be-blue-school" },
  { clienteNome: "Brasília Swiss Park", accountId: "1198195726897101", plataforma: "META", slugSugerido: "brasilia-swiss-park" },
  { clienteNome: "Casa Basca", accountId: "622407677384946", plataforma: "META", slugSugerido: "casa-basca" },
  { clienteNome: "Clinica e Spa Vida Natural", accountId: "1348043568686974", plataforma: "META", slugSugerido: "clinica-vida-natural" },
  { clienteNome: "D'or", accountId: "4053286638277990", plataforma: "META", slugSugerido: "d-or" },
  { clienteNome: "Dr. Fernando Guena", accountId: "885412763541613", plataforma: "META", slugSugerido: "dr-fernando-guena" },
  { clienteNome: "Florien FitoAtivos", accountId: "128916100945056", plataforma: "META", slugSugerido: "florien" },
  { clienteNome: "Granarolo", accountId: "1308551370629138", plataforma: "META", slugSugerido: "granarolo" },
  { clienteNome: "Melaço de Cana", accountId: "355437085993604", plataforma: "META", slugSugerido: "melaco-de-cana" },
  { clienteNome: "Miguel Imoveis", accountId: "918403042665540", plataforma: "META", slugSugerido: "miguel-imoveis" },
  { clienteNome: "Sou + Charitas", accountId: "456690009221165", plataforma: "META", slugSugerido: "sou-charitas" },
  { clienteNome: "Sou + Icaraí", accountId: "256378515824636", plataforma: "META", slugSugerido: "sou-icarai" },
  { clienteNome: "Sou + Itacoa", accountId: "2636410279889512", plataforma: "META", slugSugerido: "sou-itacoa" },
  { clienteNome: "Sou + Wellness", accountId: "1181625082289286", plataforma: "META", slugSugerido: "sou-wellness" },
  { clienteNome: "Swiss Park AGV REAL", accountId: "1051359931580682", plataforma: "META", slugSugerido: "swiss-park-agv" },
  { clienteNome: "Swiss Park Anápolis", accountId: "448161170907452", plataforma: "META", slugSugerido: "swiss-park-anapolis" },
  { clienteNome: "Swiss Park Caieiras", accountId: "1945969979179112", plataforma: "META", slugSugerido: "swiss-park-caieiras" },
  { clienteNome: "Vito Balducci", accountId: "719954580443704", plataforma: "META", slugSugerido: "vito-balducci" },
  { clienteNome: "Yema", accountId: "1961705977915455", plataforma: "META", slugSugerido: "yema" },
];

function normalizeForMatch(value: string) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function normalizeGoogleId(value: string) {
  return value.replace(/\D/g, "");
}

function normalizeMetaId(value: string) {
  return value.replace(/^act_/i, "").replace(/\D/g, "");
}

async function upsertConta(clienteId: string, plataforma: "GOOGLE_ADS" | "META", accountId: string, nomeConta: string) {
  const normalizedAccountId =
    plataforma === "GOOGLE_ADS" ? normalizeGoogleId(accountId) : normalizeMetaId(accountId);

  const existing = await prisma.conta.findFirst({
    where: { clienteId, plataforma },
  });

  if (existing) {
    return prisma.conta.update({
      where: { id: existing.id },
      data: {
        accountIdPlataforma: normalizedAccountId,
        nomeConta,
      },
    });
  }

  return prisma.conta.create({
    data: {
      clienteId,
      plataforma,
      accountIdPlataforma: normalizedAccountId,
      nomeConta,
    },
  });
}

async function findCliente(seed: AccountSeed) {
  const clientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, slug: true },
  });

  const targetName = normalizeForMatch(seed.clienteNome);
  const targetSlug = normalizeForMatch(seed.slugSugerido ?? "");

  return (
    clientes.find((cliente) => normalizeForMatch(cliente.slug) === targetSlug) ??
    clientes.find((cliente) => normalizeForMatch(cliente.nome) === targetName) ??
    clientes.find((cliente) => normalizeForMatch(cliente.slug) === targetName) ??
    clientes.find((cliente) => {
      const nome = normalizeForMatch(cliente.nome);
      return nome.includes(targetName) || targetName.includes(nome);
    }) ??
    null
  );
}

async function processSeeds(seeds: AccountSeed[]) {
  let linked = 0;
  let missing = 0;

  for (const seed of seeds) {
    const cliente = await findCliente(seed);

    if (!cliente) {
      missing++;
      console.log(`[NAO_ENCONTRADO] ${seed.plataforma} :: ${seed.clienteNome} -> ${seed.accountId}`);
      continue;
    }

    await upsertConta(cliente.id, seed.plataforma, seed.accountId, seed.clienteNome);
    linked++;
    console.log(
      `[OK] ${seed.plataforma} :: ${seed.clienteNome} -> ${cliente.nome} (${cliente.slug}) = ${seed.accountId}`
    );
  }

  return { linked, missing };
}

async function main() {
  console.log("\n=== Importando contas Google Ads ===\n");
  const google = await processSeeds(googleAccounts);

  console.log("\n=== Importando contas Meta Ads ===\n");
  const meta = await processSeeds(metaAccounts);

  console.log("\n=== Resumo ===\n");
  console.log(`Google Ads: ${google.linked} vinculada(s), ${google.missing} não encontrada(s)`);
  console.log(`Meta Ads:   ${meta.linked} vinculada(s), ${meta.missing} não encontrada(s)`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
