/**
 * Carga Pipedrive → Vilaris em produção (ESM + Prisma do container).
 *
 *   docker cp … /tmp/import-pipedrive-vilaris-prod.mjs
 *   docker exec $WEB node /tmp/import-pipedrive-vilaris-prod.mjs --apply
 */
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const { PrismaClient, Prisma } = require("/app/lib/generated/prisma/index.js");
const prisma = new PrismaClient();

const SLUG = "vilaris";
const apply = process.argv.includes("--apply");

const DEALS = [
  { title: "Luana Eloia", value: 0, org: "", name: "Luana Eloia", stage: "4. Proposta Enviada", phone: "66999279549" },
  { title: "Aline Guli", value: 5500, org: "Cresol", name: "Aline Guli", stage: "6. Manter Relacionamento", phone: "66996696826" },
  { title: "Diogo", value: 3750, org: "Indicação Erick", name: "Diogo", stage: "4. Proposta Enviada", phone: "66999788802" },
  { title: "Renan Bergamin", value: 0, org: "Sicoob", name: "Renan Bergamin", stage: "0. Entrada/Oportunidade", phone: "66999444106" },
  { title: "Bruno (Conecta)", value: 3750, org: "Cresol", name: "Bruno (Conecta)", stage: "6. Manter Relacionamento", phone: "44988575057" },
  { title: "Tiago Pedroni", value: 5500, org: "Sicredi", name: "Tiago Pedroni", stage: "6. Manter Relacionamento", phone: "66984344360" },
  { title: "Marne Greyck", value: 5500, org: "Sicredi", name: "Marne Greyck", stage: "6. Manter Relacionamento", phone: "92981186991" },
  { title: "Laylson", value: 3750, org: "Sicredi", name: "Laylson", stage: "6. Manter Relacionamento", phone: "93981024815" },
  { title: "Vitor Xavier", value: 3750, org: "Sicredi Grandes Rios", name: "Vitor Xavier", stage: "6. Manter Relacionamento", phone: "66996656160" },
  { title: "Eloir Amorim", value: 5500, org: "Sicredi Grandes Rios", name: "Eloir Amorim", stage: "6. Manter Relacionamento", phone: "93992231011" },
  { title: "Dean (Ind. Maria Joana)", value: 3750, org: "Sicredi", name: "Dean", stage: "6. Manter Relacionamento", phone: "65992060918" },
  { title: "Henrik (Ind. Adriano Nardes)", value: 3750, org: "Sicredi", name: "Henrik", stage: "6. Manter Relacionamento", phone: "66992462285" },
  { title: "Rainer Watanabe", value: 3750, org: "Santander", name: "Rainer Watanabe", stage: "6. Manter Relacionamento", phone: "66996849633" },
  { title: "Luis Hernique", value: 3750, org: "Sicoob", name: "Luis Hernique", stage: "6. Manter Relacionamento", phone: "66999206064" },
  { title: "Ana Paula Cavalheiro (Indicação Wagner Blasi)", value: 3750, org: "Cresol", name: "Ana Paula Cavalheiro", stage: "6. Manter Relacionamento", phone: "66996269675" },
  { title: "Guilherme Ferreira", value: 3750, org: "Cresol Uniao", name: "Guilherme Ferreira", stage: "6. Manter Relacionamento", phone: "" },
  { title: "Amanda (Indicação Max)", value: 5500, org: "Sicredi", name: "Amanda", stage: "6. Manter Relacionamento", phone: "66996553976" },
  { title: "Eduardo Godoy", value: 0, org: "Sicoob", name: "Eduardo Godoy", stage: "0. Entrada/Oportunidade", phone: "" },
  { title: "Celso Cicca", value: 3750, org: "Sicredi Grandes Rios", name: "Celso Cicca", stage: "5. Pagamento Pendente", phone: "" },
  { title: "Mariza Arêas", value: 3750, org: "", name: "Mariza Arêas", stage: "5. Pagamento Pendente", phone: "47991044228" },
  { title: "Gustavo Benicio (Ind Maxwel)", value: 3750, org: "Sicredi Grandes Rios", name: "Gustavo Benicio", stage: "4. Proposta Enviada", phone: "66992359402" },
  { title: "Diego Leal (Ind Bruno Conecta)", value: 3750, org: "Coamo", name: "Diego Leal", stage: "6. Manter Relacionamento", phone: "42999359610" },
  { title: "Daniela Michelon (Ind Amanda)", value: 3750, org: "Sicredi Grandes Rios", name: "Daniela Michelon", stage: "4. Proposta Enviada", phone: "66999077614" },
  { title: "Hellen Tapurah", value: 0, org: "Cresol Uniao", name: "Hellen Tapurah", stage: "0. Entrada/Oportunidade", phone: "" },
  { title: "Jalisson Horn", value: 0, org: "Sicoob", name: "Jalisson Horn", stage: "0. Entrada/Oportunidade", phone: "" },
  { title: "Raiane", value: 0, org: "Sicredi", name: "Raiane", stage: "0. Entrada/Oportunidade", phone: "" },
  { title: "William", value: 0, org: "Sicredi Grandes Rios", name: "William", stage: "0. Entrada/Oportunidade", phone: "" },
  { title: "Igor Manelli (Ind. Gui Honorio Serpa)", value: 0, org: "Cresol Uniao", name: "Igor Manelli", stage: "6. Manter Relacionamento", phone: "46999055796" },
  { title: "Osvaldo Martins (Ind. Dani)", value: 0, org: "Sicredi Grandes Rios", name: "Osvaldo Martins", stage: "0. Entrada/Oportunidade", phone: "93981306070" },
  { title: "Sofia (Ind. Dani)", value: 0, org: "Sicredi Grandes Rios", name: "Sofia", stage: "0. Entrada/Oportunidade", phone: "93981112604" },
  { title: "Bruna (Ind. Renan)", value: 0, org: "Mapfre", name: "Bruna", stage: "0. Entrada/Oportunidade", phone: "66999056064" },
  { title: "Gabryelle (Ind. Renan)", value: 0, org: "Sicoob", name: "Gabryelle", stage: "0. Entrada/Oportunidade", phone: "66996362280" },
  { title: "Juliana Beatriz (Ind. Renan)", value: 0, org: "Sicoob", name: "Juliana Beatriz", stage: "0. Entrada/Oportunidade", phone: "69981069313" },
  { title: "Juliane Porto (Ind. Renan)", value: 0, org: "", name: "Juliane Porto", stage: "0. Entrada/Oportunidade", phone: "66996110031" },
  { title: "Rafael irmão Renan", value: 0, org: "", name: "Rafael irmão Renan", stage: "0. Entrada/Oportunidade", phone: "66999831383" },
  { title: "Jeferson (ind Edson)", value: 0, org: "", name: "Jeferson", stage: "0. Entrada/Oportunidade", phone: "67981148902" },
];

const MAP = {
  "0. Entrada/Oportunidade": "ENTRY",
  "4. Proposta Enviada": "Proposta Enviada",
  "5. Pagamento Pendente": "Pagamento Pendente",
  "6. Manter Relacionamento": "Manter Relacionamento",
};

const COLORS = {
  "Proposta Enviada": "#FF9500",
  "Pagamento Pendente": "#AF52DE",
  "Manter Relacionamento": "#34C759",
};

function digits(p) {
  return String(p || "").replace(/\D/g, "");
}

function keyOf(d) {
  const ph = digits(d.phone);
  if (ph.length >= 10) return `phone:${ph.slice(-11)}`;
  return `name:${d.name.trim().toLowerCase()}|${d.title.trim().toLowerCase()}`;
}

function asMeta(v) {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...v } : {};
}

async function loadPipeline(clienteId) {
  const pipeline = await prisma.crmPipeline.findFirst({
    where: { clienteId, isDefault: true },
    orderBy: { createdAt: "asc" },
  });
  if (!pipeline) throw new Error("Pipeline default ausente");
  const stages = await prisma.crmStage.findMany({
    where: { pipelineId: pipeline.id },
    orderBy: { order: "asc" },
  });
  // role via raw (campo pode existir)
  const roles = await prisma.$queryRaw`
    SELECT id, role FROM "CrmStage" WHERE "pipelineId" = ${pipeline.id}
  `;
  const roleMap = new Map(roles.map((r) => [r.id, r.role]));
  return {
    ...pipeline,
    stages: stages.map((s) => ({ ...s, role: roleMap.get(s.id) ?? null })),
  };
}

async function ensureSaleStages(clienteId) {
  let pipeline = await loadPipeline(clienteId);
  const won = pipeline.stages.find((s) => s.role === "WON");
  for (const name of ["Proposta Enviada", "Pagamento Pendente", "Manter Relacionamento"]) {
    if (pipeline.stages.some((s) => s.name.toLowerCase() === name.toLowerCase())) {
      console.log(`  · etapa ok: ${name}`);
      continue;
    }
    const insertOrder = won ? won.order : pipeline.stages.length;
    const toShift = [...pipeline.stages]
      .filter((s) => s.order >= insertOrder)
      .sort((a, b) => b.order - a.order);
    for (const s of toShift) {
      await prisma.crmStage.update({ where: { id: s.id }, data: { order: s.order + 1 } });
    }
    await prisma.crmStage.create({
      data: {
        pipelineId: pipeline.id,
        name,
        order: insertOrder,
        color: COLORS[name] || "#8E8E93",
      },
    });
    console.log(`  + etapa criada: ${name}`);
    pipeline = await loadPipeline(clienteId);
  }
  return pipeline;
}

async function findByKey(clienteId, key) {
  const leads = await prisma.nativeLead.findMany({
    where: { clienteId, source: "pipedrive" },
    select: { id: true, metadata: true },
  });
  return leads.find((l) => asMeta(l.metadata).pipedriveKey === key) || null;
}

async function findProtected(clienteId, ph) {
  if (ph.length < 10) return null;
  const tail = ph.slice(-8);
  const contacts = await prisma.nativeContact.findMany({
    where: { clienteId, phone: { contains: tail } },
    select: { id: true, phone: true },
  });
  const match = contacts.find((c) => {
    const d = digits(c.phone);
    return d.endsWith(ph) || d.endsWith(ph.slice(-11));
  });
  if (!match) return null;
  const lead = await prisma.nativeLead.findFirst({
    where: { clienteId, contactId: match.id, status: "OPEN" },
    select: { id: true, source: true, metadata: true },
  });
  if (!lead) return null;
  if (lead.source === "pipedrive" || asMeta(lead.metadata).pipedriveImport) return null;
  return lead;
}

async function upsertContact(clienteId, name, phone) {
  const ph = digits(phone);
  if (ph.length >= 10) {
    const all = await prisma.nativeContact.findMany({
      where: { clienteId, phone: { contains: ph.slice(-8) } },
    });
    const hit = all.find((c) => {
      const d = digits(c.phone);
      return d === ph || d.endsWith(ph) || ph.endsWith(d);
    });
    if (hit) {
      if (name && hit.name !== name) {
        return prisma.nativeContact.update({ where: { id: hit.id }, data: { name } });
      }
      return hit;
    }
  }
  return prisma.nativeContact.create({
    data: {
      clienteId,
      name: name || ph || "Lead",
      phone: ph.length >= 10 ? ph : null,
    },
  });
}

async function main() {
  console.log(apply ? "== APPLY ==" : "== DRY-RUN ==");
  const cliente = await prisma.cliente.findFirst({
    where: { slug: SLUG },
    select: { id: true, nome: true },
  });
  if (!cliente) throw new Error("Workspace vilaris não encontrado");
  console.log(`Workspace: ${cliente.nome} (${cliente.id})`);

  let pipeline = await loadPipeline(cliente.id);
  const entry = pipeline.stages.find((s) => s.role === "ENTRY");
  if (!entry) throw new Error("ENTRY ausente");

  if (apply) {
    console.log("Etapas de venda:");
    pipeline = await ensureSaleStages(cliente.id);
  }

  const stageIds = new Map();
  stageIds.set("ENTRY", pipeline.stages.find((s) => s.role === "ENTRY").id);
  for (const name of ["Proposta Enviada", "Pagamento Pendente", "Manter Relacionamento"]) {
    const s = pipeline.stages.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (s) stageIds.set(name, s.id);
    else if (apply) throw new Error(`Etapa faltando: ${name}`);
  }

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let protectedSkip = 0;
  const counts = {};

  for (const deal of DEALS) {
    const target = MAP[deal.stage];
    if (!target) {
      skipped++;
      continue;
    }
    counts[target] = (counts[target] || 0) + 1;
    const key = keyOf(deal);
    const ph = digits(deal.phone);
    const line = `${deal.name} | ${deal.stage} → ${target} | R$ ${deal.value} | ${deal.org || "-"}`;

    if (!apply) {
      console.log(`  ~ ${line}`);
      continue;
    }

    const stageId = stageIds.get(target);
    const meta = {
      pipedriveImport: true,
      pipedriveKey: key,
      organization: deal.org || null,
      pipedriveStage: deal.stage,
      pipedriveValue: deal.value,
      pipedriveTitle: deal.title,
    };

    const existing = await findByKey(cliente.id, key);
    if (existing) {
      await prisma.nativeLead.update({
        where: { id: existing.id },
        data: {
          stageId,
          status: "OPEN",
          dealValue: new Prisma.Decimal(deal.value),
          metadata: { ...asMeta(existing.metadata), ...meta },
        },
      });
      updated++;
      console.log(`  ↻ ${line}`);
      continue;
    }

    if (ph.length >= 10) {
      const prot = await findProtected(cliente.id, ph);
      if (prot) {
        protectedSkip++;
        console.log(`  ⊗ protegido: ${line} (${prot.source})`);
        continue;
      }
    }

    const contact = await upsertContact(cliente.id, deal.name || deal.title, deal.phone);
    const open = await prisma.nativeLead.findFirst({
      where: { clienteId: cliente.id, contactId: contact.id, status: "OPEN" },
    });
    if (open) {
      // Reusa card aberto (mesmo contato), marca como pipedrive só se ainda sem source forte
      await prisma.nativeLead.update({
        where: { id: open.id },
        data: {
          stageId,
          status: "OPEN",
          dealValue: new Prisma.Decimal(deal.value),
          source: open.source === "pipedrive" || !open.source ? "pipedrive" : open.source,
          metadata: { ...asMeta(open.metadata), ...meta },
        },
      });
      updated++;
      console.log(`  ↻ contact-open ${line}`);
      continue;
    }

    const lead = await prisma.nativeLead.create({
      data: {
        clienteId: cliente.id,
        contactId: contact.id,
        stageId,
        status: "OPEN",
        source: "pipedrive",
        dealValue: new Prisma.Decimal(deal.value),
        metadata: meta,
      },
    });
    created++;
    console.log(`  + ${line} → ${lead.id}`);
  }

  console.log("\nResumo destino:", counts);
  console.log({ apply, created, updated, skipped, protectedSkip, total: DEALS.length });

  if (apply) {
    const byStage = await prisma.nativeLead.groupBy({
      by: ["stageId"],
      where: { clienteId: cliente.id, source: "pipedrive" },
      _count: { _all: true },
      _sum: { dealValue: true },
    });
    const names = new Map(pipeline.stages.map((s) => [s.id, s.name]));
    console.log("\nPipedrive no board:");
    for (const row of byStage) {
      console.log(
        `  ${names.get(row.stageId) || row.stageId}: ${row._count._all} · R$ ${Number(row._sum.dealValue || 0)}`,
      );
    }
    const won = await prisma.nativeLead.count({
      where: { clienteId: cliente.id, source: "pipedrive", status: "WON" },
    });
    console.log(`WON pipedrive (deve 0): ${won}`);
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
