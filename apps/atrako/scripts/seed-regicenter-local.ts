/**
 * Cria workspace Regicenter local + OWNER + forms de captura.
 *
 *   npx tsx scripts/seed-regicenter-local.ts
 *
 * Login: regicenter@atrako.local / admin123
 */

import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";
import { ensureRegicenterQualifyForms } from "../lib/qualification/ensure-forms";
import { franchiseRegicenterPatch, mergeMessagingPrefs } from "../lib/qualification/playbook";
import { ensureDefaultPipeline, applyPipelinePreset } from "../lib/modules/crm";
import { applyWorkspaceEdition } from "../lib/modules/apply-edition";
import { Prisma } from "../lib/generated/prisma";

const EMAIL = "regicenter@atrako.local";
const PASSWORD = "admin123";
const SLUG = "regicenter";

async function upsertCliente() {
  const existing = await prisma.cliente.findFirst({
    where: {
      OR: [
        { slug: SLUG },
        { nome: { contains: "regicenter", mode: "insensitive" } },
      ],
    },
  });
  if (existing) {
    return prisma.cliente.update({
      where: { id: existing.id },
      data: {
        nome: "Regicenter",
        slug: SLUG,
        ativo: true,
        segmento: "Propriedade intelectual / franquia",
        produtoServico:
          "Franquia Regicenter de registro de marcas e patentes; também registro de marca, patente, software, direitos autorais, indicação geográfica e desenho industrial.",
        modeloNegocio:
          "Franquia com operação e suporte jurídico pela matriz; escritório de PI desde 2012.",
        publicoAlvo:
          "Investidores de franquia (advogados, contabilidade, marketing, seguros, SaaS).",
        objetivoProjeto: "Qualificar franqueados e agendar primeira reunião com expansão.",
        objetivoMidia: "leads",
      },
    });
  }
  return prisma.cliente.create({
    data: {
      nome: "Regicenter",
      slug: SLUG,
      ativo: true,
      segmento: "Propriedade intelectual / franquia",
      produtoServico:
        "Franquia Regicenter de registro de marcas e patentes; também registro de marca, patente, software, direitos autorais, indicação geográfica e desenho industrial.",
      modeloNegocio:
        "Franquia com operação e suporte jurídico pela matriz; escritório de PI desde 2012.",
      publicoAlvo:
        "Investidores de franquia (advogados, contabilidade, marketing, seguros, SaaS).",
      objetivoProjeto: "Qualificar franqueados e agendar primeira reunião com expansão.",
      objetivoMidia: "leads",
    },
  });
}

async function upsertOwner(clienteId: string) {
  const passwordHash = await hashPassword(PASSWORD);
  const existing = await prisma.workspaceMember.findFirst({
    where: { email: EMAIL },
  });
  if (existing) {
    return prisma.workspaceMember.update({
      where: { id: existing.id },
      data: {
        clienteId,
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Regicenter",
      },
    });
  }
  return prisma.workspaceMember.create({
    data: {
      clienteId,
      email: EMAIL,
      name: "Regicenter",
      role: "OWNER",
      active: true,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}

async function main() {
  const cliente = await upsertCliente();
  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const member = await upsertOwner(cliente.id);
  console.log("OWNER:", member.email, `(senha ${PASSWORD})`);

  const forms = await ensureRegicenterQualifyForms(cliente.id);
  console.log("Forms:", forms);

  await ensureDefaultPipeline(cliente.id);
  await applyWorkspaceEdition(cliente.id, "inside_sales");
  console.log("Edição: inside_sales (sem loja / marketplace / Instagram)");

  const settings = await prisma.workspaceSettings.findUnique({ where: { clienteId: cliente.id } });
  const attendance = {
    about:
      "A Regicenter registra marcas e patentes no Brasil e no exterior desde 2012, com assessoria jurídica e operação centralizada.",
    sells:
      "Franquia de registro de marcas/patentes e serviços de PI: marca, patente, software, direitos autorais, desenho industrial.",
    conditions: "Pesquisa de viabilidade gratuita. Atendimento seg–sex 8h–18h.",
    tone: "Claro, direto, profissional — sem pressão e sem falar de valores no início.",
    handoffWhen: "Lead pediu humano, prioridade A/B concluída, ou dúvida jurídica complexa.",
    mode: "qualify",
    waEnabled: true,
    hourPreset: "weekdays",
    hourStart: "08:00",
    hourEnd: "18:00",
    offerKind: "none",
  };

  const messagingPrefs = mergeMessagingPrefs(settings?.messagingPrefs, {
    attendance,
    ...franchiseRegicenterPatch(true),
  });

  await prisma.workspaceSettings.upsert({
    where: { clienteId: cliente.id },
    create: {
      clienteId: cliente.id,
      messagingPrefs: messagingPrefs as Prisma.InputJsonValue,
    },
    update: {
      messagingPrefs: messagingPrefs as Prisma.InputJsonValue,
    },
  });

  console.log("OK — playbook franchise_regicenter ligado.");
  console.log("LP:       http://localhost:5000/f/franquia-regicenter-lp");
  console.log("Typeform: http://localhost:5000/f/franquia-regicenter-qualify");
  console.log("CRM:      http://localhost:5000/crm (login com o OWNER acima)");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
