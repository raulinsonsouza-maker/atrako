/**
 * Seed Vilaris em produção (plain ESM).
 *   docker cp … /tmp/seed-vilaris-prod.mjs
 *   docker exec $CID node /tmp/seed-vilaris-prod.mjs
 */
import { createRequire } from "node:module";
import { randomBytes, scrypt as nodeScrypt } from "node:crypto";
import { promisify } from "node:util";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("/app/lib/generated/prisma/index.js");
const prisma = new PrismaClient();
const scryptAsync = promisify(nodeScrypt);

const EMAIL = "crm@vilaris.com.br";
const LEGACY_EMAIL = "vilaris@atrako.com.br";
const DEFAULT_PASSWORD = "Vilaris@2026";
const SLUG = "vilaris";
const LOGO = "/lp/vilaris/assets/vilaris-logo.png";
const PRIMARY = "#354a5c";

const SCRYPT_N = 32768;
const SCRYPT_R = 8;
const SCRYPT_P = 1;
const SCRYPT_KEY_BYTES = 32;
const SCRYPT_SALT_BYTES = 16;
const SCRYPT_MAXMEM = 64 * 1024 * 1024;

const STEPS = [
  {
    id: "lead",
    title: "Conversa",
    fields: [
      { id: "name", type: "text", label: "Nome completo", required: true },
      { id: "phone", type: "phone", label: "WhatsApp", required: true },
      { id: "email", type: "email", label: "E-mail", required: true },
      { id: "role", type: "text", label: "Cargo atual", required: true },
      { id: "area", type: "text", label: "Área de atuação", required: true },
      {
        id: "moment",
        type: "choice",
        label: "O que melhor representa seu momento?",
        required: true,
        options: [
          "Quero mudar de área ou setor",
          "Estou buscando uma recolocação",
          "Quero crescer mais rápido na empresa atual",
          "Quero chegar a uma posição de liderança",
          "Ainda não tenho clareza sobre meu próximo passo",
        ],
      },
      {
        id: "challenge",
        type: "text",
        label: "Qual é o principal desafio da sua carreira?",
        required: true,
      },
    ],
  },
];

const BASE_STAGES = [
  { name: "Novo", order: 0, color: "#8E8E93", role: "ENTRY" },
  { name: "Qualificado", order: 1, color: "#0066cc", role: null },
  { name: "Em conversa", order: 2, color: "#0071e3", role: null },
  { name: "Proposta", order: 3, color: "#FF9500", role: null },
  { name: "Negociação", order: 4, color: "#AF52DE", role: null },
  { name: "Ganho", order: 5, color: "#34C759", role: "WON" },
];

async function hashPassword(password) {
  const salt = randomBytes(SCRYPT_SALT_BYTES);
  const derived = await scryptAsync(password, salt, SCRYPT_KEY_BYTES, {
    N: SCRYPT_N,
    r: SCRYPT_R,
    p: SCRYPT_P,
    maxmem: SCRYPT_MAXMEM,
  });
  return `scrypt-v1$${SCRYPT_N},${SCRYPT_R},${SCRYPT_P}$${salt.toString("base64url")}$${Buffer.from(derived).toString("base64url")}`;
}

async function main() {
  const password = process.env.VILARIS_OWNER_PASSWORD?.trim() || DEFAULT_PASSWORD;

  let cliente = await prisma.cliente.findFirst({
    where: { OR: [{ slug: SLUG }, { nome: { contains: "vilaris", mode: "insensitive" } }] },
  });
  const clienteData = {
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
  cliente = cliente
    ? await prisma.cliente.update({ where: { id: cliente.id }, data: clienteData })
    : await prisma.cliente.create({ data: clienteData });
  console.log("Cliente:", cliente.id, cliente.nome, cliente.slug);

  const passwordHash = await hashPassword(password);
  const existingMember = await prisma.workspaceMember.findFirst({
    where: { OR: [{ email: EMAIL }, { email: LEGACY_EMAIL }] },
  });
  const member = existingMember
    ? await prisma.workspaceMember.update({
        where: { id: existingMember.id },
        data: {
          clienteId: cliente.id,
          email: EMAIL,
          passwordHash,
          passwordUpdatedAt: new Date(),
          role: "OWNER",
          active: true,
          name: "Vilaris",
        },
      })
    : await prisma.workspaceMember.create({
        data: {
          clienteId: cliente.id,
          email: EMAIL,
          name: "Vilaris",
          role: "OWNER",
          active: true,
          passwordHash,
          passwordUpdatedAt: new Date(),
        },
      });
  console.log("OWNER:", member.email);

  const formSlug = "vilaris-lp";
  const existingForm = await prisma.captureForm.findFirst({ where: { slug: formSlug } });
  if (existingForm && existingForm.clienteId !== cliente.id) {
    throw new Error(`Slug ${formSlug} já existe em outro workspace`);
  }
  if (existingForm) {
    await prisma.$executeRaw`
      UPDATE "CaptureForm"
      SET name = ${"Vilaris — Mentoria de Carreira"}, steps = ${JSON.stringify(STEPS)}::jsonb,
          source = ${"lp"}, status = 'PUBLISHED', active = true, "updatedAt" = NOW()
      WHERE id = ${existingForm.id}
    `;
    console.log("Form:", { id: existingForm.id, slug: formSlug, created: false });
  } else {
    const created = await prisma.captureForm.create({
      data: {
        clienteId: cliente.id,
        name: "Vilaris — Mentoria de Carreira",
        slug: formSlug,
        steps: STEPS,
        source: "lp",
        status: "PUBLISHED",
        active: true,
      },
    });
    console.log("Form:", { id: created.id, slug: created.slug, created: true });
  }

  let pipeline = await prisma.crmPipeline.findFirst({
    where: { clienteId: cliente.id, isDefault: true },
    include: { stages: true },
  });
  if (!pipeline) {
    pipeline = await prisma.crmPipeline.create({
      data: {
        clienteId: cliente.id,
        name: "Principal",
        isDefault: true,
        preset: "leads",
        stages: {
          create: BASE_STAGES.map((s) => ({
            name: s.name,
            order: s.order,
            color: s.color,
          })),
        },
      },
      include: { stages: true },
    });
    for (const s of BASE_STAGES) {
      if (!s.role) continue;
      await prisma.$executeRaw`
        UPDATE "CrmStage"
        SET "role" = ${s.role}
        WHERE "pipelineId" = ${pipeline.id} AND "name" = ${s.name} AND "role" IS NULL
      `;
    }
    console.log("Pipeline:", pipeline.id);
  } else {
    console.log("Pipeline: already exists", pipeline.id);
  }

  const modulesEnabled = {
    forms: true,
    whatsapp: true,
    relacionamento: true,
    finance: true,
    assistente: true,
    food: false,
    agenda: false,
    commerce: false,
    social: false,
  };
  const messagingPrefs = {
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
      edition: "inside_sales",
      modulesEnabled,
      messagingPrefs,
    },
    update: {
      primaryColor: PRIMARY,
      logoOnDarkUrl: LOGO,
      edition: "inside_sales",
      modulesEnabled,
      messagingPrefs,
    },
  });

  console.log("OK — sem playbook de franquia/COF.");
  console.log("LP:  https://atrako.com.br/vilaris");
  console.log("CRM: https://atrako.com.br/vilaris/crm");
  console.log(`Login: ${EMAIL} / ${password}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
