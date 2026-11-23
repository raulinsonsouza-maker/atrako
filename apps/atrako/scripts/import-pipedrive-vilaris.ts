/**
 * Carga one-shot: export Pipedrive (deals abertos) → CRM Vilaris.
 *
 *   npx tsx apps/atrako/scripts/import-pipedrive-vilaris.ts
 *   npx tsx apps/atrako/scripts/import-pipedrive-vilaris.ts --apply
 *
 * - Todos OPEN (nada em Ganho/Perdido)
 * - dealValue via prisma (sem ledger)
 * - Sem e-mail de equipe / nurture
 */

import { Prisma } from "../lib/generated/prisma";
import { prisma } from "../lib/db";
import { captureExternalLead } from "../lib/crm/capture-external";
import {
  createPipelineStage,
  ensureDefaultPipeline,
  updateLeadStage,
} from "../lib/modules/crm";

const SLUG = "vilaris";

type DealRow = {
  title: string;
  value: number;
  org: string;
  name: string;
  stage: string;
  phone: string;
};

/** Snapshot do deals-27039322-3.xlsx (36 negócios abertos). */
const DEALS: DealRow[] = [
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

const STAGE_COLORS: Record<string, string> = {
  "Proposta Enviada": "#FF9500",
  "Pagamento Pendente": "#AF52DE",
  "Manter Relacionamento": "#34C759",
};

const PIPEDRIVE_TO_CRM: Record<string, "ENTRY" | "Proposta Enviada" | "Pagamento Pendente" | "Manter Relacionamento"> = {
  "0. Entrada/Oportunidade": "ENTRY",
  "4. Proposta Enviada": "Proposta Enviada",
  "5. Pagamento Pendente": "Pagamento Pendente",
  "6. Manter Relacionamento": "Manter Relacionamento",
};

function phoneDigits(raw: string): string {
  return raw.replace(/\D/g, "");
}

function pipedriveKey(d: DealRow): string {
  const digits = phoneDigits(d.phone);
  if (digits.length >= 10) return `phone:${digits.slice(-11)}`;
  return `name:${d.name.trim().toLowerCase()}|${d.title.trim().toLowerCase()}`;
}

function asMeta(v: unknown): Record<string, unknown> {
  return v && typeof v === "object" && !Array.isArray(v) ? { ...(v as Record<string, unknown>) } : {};
}

async function ensureSaleStages(workspaceId: string) {
  let pipeline = await ensureDefaultPipeline(workspaceId);
  const needed = ["Proposta Enviada", "Pagamento Pendente", "Manter Relacionamento"] as const;
  for (const name of needed) {
    const exists = pipeline.stages.find((s) => s.name.toLowerCase() === name.toLowerCase());
    if (!exists) {
      await createPipelineStage({
        workspaceId,
        name,
        color: STAGE_COLORS[name] ?? "#8E8E93",
      });
      pipeline = await ensureDefaultPipeline(workspaceId);
      console.log(`  + etapa criada: ${name}`);
    } else {
      console.log(`  · etapa ok: ${name}`);
    }
  }
  return ensureDefaultPipeline(workspaceId);
}

async function findImportedLead(workspaceId: string, key: string) {
  const leads = await prisma.nativeLead.findMany({
    where: { clienteId: workspaceId, source: "pipedrive" },
    select: { id: true, metadata: true, contactId: true, stageId: true, dealValue: true, status: true },
  });
  return leads.find((l) => asMeta(l.metadata).pipedriveKey === key) ?? null;
}

async function findProtectedLeadByPhone(workspaceId: string, digits: string) {
  if (digits.length < 10) return null;
  const tail = digits.slice(-11);
  const contacts = await prisma.nativeContact.findMany({
    where: { clienteId: workspaceId, phone: { contains: tail.slice(-8) } },
    select: { id: true, phone: true, name: true },
  });
  const match = contacts.find((c) => phoneDigits(c.phone ?? "").endsWith(tail) || phoneDigits(c.phone ?? "").endsWith(digits));
  if (!match) return null;
  const lead = await prisma.nativeLead.findFirst({
    where: { clienteId: workspaceId, contactId: match.id, status: "OPEN" },
    select: { id: true, source: true, metadata: true },
  });
  if (!lead) return null;
  if (lead.source === "pipedrive" || asMeta(lead.metadata).pipedriveImport) return null;
  // Lead LP/Meta existente — não sobrescrever
  return lead;
}

async function main() {
  const apply = process.argv.includes("--apply");
  console.log(apply ? "== APPLY ==" : "== DRY-RUN (passe --apply para gravar) ==");

  const cliente = await prisma.cliente.findFirst({
    where: { slug: SLUG },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) throw new Error("Workspace vilaris não encontrado");
  console.log(`Workspace: ${cliente.nome} (${cliente.id})`);

  let pipeline = await ensureDefaultPipeline(cliente.id);
  const entry = pipeline.stages.find((s) => s.role === "ENTRY");
  if (!entry) throw new Error("Etapa ENTRY ausente");

  if (apply) {
    console.log("Etapas de venda:");
    pipeline = await ensureSaleStages(cliente.id);
  } else {
    console.log("Etapas (dry-run — cria só com --apply): Proposta Enviada, Pagamento Pendente, Manter Relacionamento");
  }

  const entryId = pipeline.stages.find((s) => s.role === "ENTRY")?.id ?? entry.id;
  const stageByTarget = new Map<string, string>();
  stageByTarget.set("ENTRY", entryId);
  for (const name of ["Proposta Enviada", "Pagamento Pendente", "Manter Relacionamento"]) {
    const s = pipeline.stages.find((x) => x.name.toLowerCase() === name.toLowerCase());
    if (s) stageByTarget.set(name, s.id);
    else if (apply) throw new Error(`Etapa faltando: ${name}`);
  }

  const counts: Record<string, number> = {};
  let created = 0;
  let updated = 0;
  let skipped = 0;
  let protectedSkip = 0;

  for (const deal of DEALS) {
    const target = PIPEDRIVE_TO_CRM[deal.stage];
    if (!target) {
      console.warn(`  ! etapa Pipedrive desconhecida: ${deal.stage} (${deal.name})`);
      skipped++;
      continue;
    }
    const stageId = stageByTarget.get(target)!;
    const key = pipedriveKey(deal);
    const digits = phoneDigits(deal.phone);
    counts[target] = (counts[target] ?? 0) + 1;

    const line = `${deal.name} | ${deal.stage} → ${target} | R$ ${deal.value} | ${deal.org || "-"} | ${key}`;

    if (!apply) {
      console.log(`  ~ ${line}`);
      continue;
    }

    const already = await findImportedLead(cliente.id, key);
    if (already) {
      await updateLeadStage({ workspaceId: cliente.id, leadId: already.id, stageId });
      await prisma.nativeLead.update({
        where: { id: already.id },
        data: {
          dealValue: new Prisma.Decimal(deal.value),
          status: "OPEN",
          metadata: {
            ...asMeta(already.metadata),
            pipedriveImport: true,
            pipedriveKey: key,
            organization: deal.org || null,
            pipedriveStage: deal.stage,
            pipedriveValue: deal.value,
            pipedriveTitle: deal.title,
          } as Prisma.InputJsonValue,
        },
      });
      updated++;
      console.log(`  ↻ ${line}`);
      continue;
    }

    if (digits.length >= 10) {
      const prot = await findProtectedLeadByPhone(cliente.id, digits);
      if (prot) {
        protectedSkip++;
        console.log(`  ⊗ protegido (LP/Meta): ${line} lead=${prot.id} source=${prot.source}`);
        continue;
      }
    }

    const captured = await captureExternalLead({
      workspaceId: cliente.id,
      name: deal.name || deal.title,
      phone: digits.length >= 10 ? digits : null,
      source: "pipedrive",
      welcome: false,
      notifyTeam: false,
      metadata: {
        pipedriveImport: true,
        pipedriveKey: key,
        organization: deal.org || null,
        pipedriveStage: deal.stage,
        pipedriveValue: deal.value,
        pipedriveTitle: deal.title,
      },
    });
    if (!captured) {
      skipped++;
      console.warn(`  ! sem identidade: ${line}`);
      continue;
    }

    await updateLeadStage({ workspaceId: cliente.id, leadId: captured.leadId, stageId });
    await prisma.nativeLead.update({
      where: { id: captured.leadId },
      data: {
        dealValue: new Prisma.Decimal(deal.value),
        status: "OPEN",
      },
    });
    created++;
    console.log(`  + ${line} → ${captured.leadId}`);
  }

  console.log("\nResumo por destino:", counts);
  console.log({ apply, created, updated, skipped, protectedSkip, total: DEALS.length });

  if (apply) {
    const byStage = await prisma.nativeLead.groupBy({
      by: ["stageId"],
      where: { clienteId: cliente.id, source: "pipedrive" },
      _count: { _all: true },
      _sum: { dealValue: true },
    });
    const nameOf = new Map(pipeline.stages.map((s) => [s.id, s.name]));
    console.log("\nPipedrive no board:");
    for (const row of byStage) {
      console.log(
        `  ${nameOf.get(row.stageId ?? "") ?? row.stageId}: ${row._count._all} · R$ ${Number(row._sum.dealValue ?? 0)}`,
      );
    }
    const wonCount = await prisma.nativeLead.count({
      where: { clienteId: cliente.id, source: "pipedrive", status: "WON" },
    });
    console.log(`WON pipedrive (deve ser 0): ${wonCount}`);
  }
}

main()
  .catch((err) => {
    console.error(err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
