/**
 * Workspace Vilaris (inside sales) + CaptureForm da LP.
 *
 *   npx tsx scripts/seed-vilaris.ts
 *
 * Login: vilaris@atrako.com.br / (senha impressa)
 */

import { randomBytes } from "node:crypto";
import { prisma } from "../lib/db";
import { hashPassword } from "../lib/authSecurity";
import { ensureVilarisLpForm } from "../lib/vilaris/ensure-forms";
import { ensureDefaultPipeline } from "../lib/modules/crm";
import { applyWorkspaceEdition } from "../lib/modules/apply-edition";
import { Prisma } from "../lib/generated/prisma";

const EMAIL = "vilaris@atrako.com.br";
const SLUG = "vilaris";
const LOGO = "/lp/vilaris/assets/vilaris-logo.png";
const PRIMARY = "#354a5c";

async function upsertCliente() {
  const existing = await prisma.cliente.findFirst({
    where: {
      OR: [{ slug: SLUG }, { nome: { contains: "vilaris", mode: "insensitive" } }],
    },
  });
  const data = {
    nome: "Vilaris",
    slug: SLUG,
    ativo: true,
    logoUrl: LOGO,
    segmento: "Mentoria de carreira / desenvolvimento profissional",
    produtoServico:
      "Mentoria de carreira (~3 meses): clareza de direção, transição, crescimento corporativo e estratégia profissional.",
    modeloNegocio: "Mentoria em grupo e individual com acompanhamento estratégico.",
    publicoAlvo:
      "Profissionais em transição, recolocação ou aceleração de carreira — empresas estruturadas, instituições financeiras e cooperativas.",
    objetivoProjeto: "Qualificar interessados na mentoria e agendar conversa de diagnóstico.",
    objetivoMidia: "leads",
  };
  if (existing) {
    return prisma.cliente.update({ where: { id: existing.id }, data });
  }
  return prisma.cliente.create({ data });
}

async function upsertOwner(clienteId: string, password: string) {
  const passwordHash = await hashPassword(password);
  const existing = await prisma.workspaceMember.findFirst({ where: { email: EMAIL } });
  if (existing) {
    return prisma.workspaceMember.update({
      where: { id: existing.id },
      data: {
        clienteId,
        passwordHash,
        passwordUpdatedAt: new Date(),
        role: "OWNER",
        active: true,
        name: "Vilaris",
      },
    });
  }
  return prisma.workspaceMember.create({
    data: {
      clienteId,
      email: EMAIL,
      name: "Vilaris",
      role: "OWNER",
      active: true,
      passwordHash,
      passwordUpdatedAt: new Date(),
    },
  });
}

async function main() {
  const password = process.env.VILARIS_OWNER_PASSWORD?.trim() || `Vil${randomBytes(4).toString("hex")}!a`;
  const cliente = await upsertCliente();
  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const member = await upsertOwner(cliente.id, password);
  console.log("OWNER:", member.email);

  const form = await ensureVilarisLpForm(cliente.id);
  console.log("Form:", form);

  await ensureDefaultPipeline(cliente.id);
  await applyWorkspaceEdition(cliente.id, "inside_sales");
  console.log("Edição: inside_sales");

  const settings = await prisma.workspaceSettings.findUnique({ where: { clienteId: cliente.id } });
  const messagingPrefs = {
    ...((settings?.messagingPrefs as object) || {}),
    attendance: {
      about:
        "A Vilaris oferece mentoria de carreira para profissionais que querem decidir o próximo movimento com mais clareza e estratégia.",
      sells: "Mentoria de carreira — encontros em grupo e individuais (~3 meses).",
      conditions: "Conversa inicial sem compromisso de matrícula.",
      tone: "Claro, direto, profissional e acolhedor — sem pressão comercial no primeiro contato.",
      handoffWhen: "Lead pediu humano ou já está pronto para a conversa de diagnóstico.",
      mode: "assist",
      waEnabled: true,
      hourPreset: "weekdays",
      hourStart: "09:00",
      hourEnd: "18:00",
      offerKind: "none",
    },
  };

  await prisma.workspaceSettings.upsert({
    where: { clienteId: cliente.id },
    create: {
      clienteId: cliente.id,
      primaryColor: PRIMARY,
      logoOnDarkUrl: LOGO,
      messagingPrefs: messagingPrefs as Prisma.InputJsonValue,
    },
    update: {
      primaryColor: PRIMARY,
      logoOnDarkUrl: LOGO,
      messagingPrefs: messagingPrefs as Prisma.InputJsonValue,
    },
  });

  console.log("OK — sem playbook de franquia/COF.");
  console.log("LP:  https://atrako.com.br/vilaris");
  console.log("CRM: https://atrako.com.br/crm");
  console.log(`Login: ${EMAIL} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
