/**
 * Configura playbook franquia Regicenter: forms LP/typeform, attendance, qualification flag.
 *
 * Uso:
 *   npx tsx apps/atrako/scripts/seed-regicenter-qualify.ts [--slug=regicenter] [--id=xxx]
 */

import { prisma } from "../lib/db";
import { ensureRegicenterQualifyForms } from "../lib/qualification/ensure-forms";
import { franchiseRegicenterPatch, mergeMessagingPrefs } from "../lib/qualification/playbook";
import { ensureDefaultPipeline, applyPipelinePreset } from "../lib/modules/crm";
import { Prisma } from "../lib/generated/prisma";

async function main() {
  const args = process.argv.slice(2);
  const idArg = args.find((a) => a.startsWith("--id="))?.slice(5);
  const slugArg = args.find((a) => a.startsWith("--slug="))?.slice(7) || "regicenter";

  const cliente = idArg
    ? await prisma.cliente.findUnique({ where: { id: idArg } })
    : await prisma.cliente.findFirst({
        where: {
          OR: [
            { slug: { contains: slugArg, mode: "insensitive" } },
            { nome: { contains: "regicenter", mode: "insensitive" } },
          ],
        },
      });

  if (!cliente) {
    console.error("Cliente Regicenter não encontrado. Passe --id= ou --slug=");
    process.exit(1);
  }

  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const forms = await ensureRegicenterQualifyForms(cliente.id);
  console.log("Forms:", forms);

  await ensureDefaultPipeline(cliente.id);
  await applyPipelinePreset(cliente.id, "leads").catch(() => null);

  const settings = await prisma.workspaceSettings.findUnique({ where: { clienteId: cliente.id } });
  const attendance = {
    about:
      "A Regicenter registra marcas e patentes no Brasil e no exterior desde 2012, com assessoria jurídica e operação centralizada.",
    sells:
      "Franquia de registro de marcas/patentes (investimento inicial informado na apresentação comercial) e serviços de PI: marca, patente, software, direitos autorais, desenho industrial.",
    conditions: "Pesquisa de viabilidade gratuita. Atendimento seg–sex 8h–18h. 0800 789 0007 · contato@regicenter.com",
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

  await prisma.cliente.update({
    where: { id: cliente.id },
    data: {
      segmento: "Propriedade intelectual / franquia",
      produtoServico:
        "Franquia Regicenter de registro de marcas e patentes; também registro de marca, patente, software, direitos autorais, indicação geográfica e desenho industrial.",
      modeloNegocio:
        "Franquia com operação e suporte jurídico pela matriz; escritório de PI desde 2012 com rede internacional (Madri, PCT, UE).",
      publicoAlvo:
        "Investidores de franquia (advogados, contabilidade, marketing, seguros, SaaS) e empresas que precisam proteger marca.",
      objetivoProjeto: "Qualificar franqueados A/B/C e agendar primeira reunião com expansão.",
      diferenciais:
        "Pesquisa gratuita, clareza de custos, operação pela Regicenter, suporte jurídico e atualizações do processo INPI.",
      observacoesAnaliticas:
        "Funil: LP/typeform → WhatsApp (só campos faltantes) → reunião. Dinheiro só no fim. Forms: franquia-regicenter-lp e franquia-regicenter-qualify.",
      objetivoMidia: "leads",
    },
  });

  console.log("OK — playbook franchise_regicenter ligado.");
  console.log("LP form: /f/franquia-regicenter-lp");
  console.log("Typeform: /f/franquia-regicenter-qualify");
  console.log("Checklist: WhatsApp conectado, template Marketing M01 (sem R$), Billing Hub.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
