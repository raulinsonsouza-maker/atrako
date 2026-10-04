import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { Prisma } from "@/lib/generated/prisma";
import { bad, flowActor, gate, readBody, str } from "@/lib/flows/api";
import { EMAIL_SAFE_FONTS, loadBrandBase, sanitizeTheme } from "@/lib/flows/theme";
import { previewEmail } from "@/lib/flows/preview";
import { sampleContact } from "@/lib/flows/campaigns";
import { sendEmailMessage } from "@/lib/flows/send";
import { refreshDefaultCopy } from "@/lib/flows/playbooks";
import type { EmailContent } from "@/lib/flows/types";

/** E-mail de demonstração do tema: usa todos os blocos. */
const DEMO: EmailContent = {
  subject: "{{primeiro_nome}}, seu carrinho está esperando",
  preheader: "Separamos tudo para você finalizar",
  blocks: [
    { type: "heading", text: "Esqueceu alguma coisa?" },
    { type: "text", text: "Oi {{primeiro_nome}}, os itens abaixo continuam no seu carrinho na **{{loja}}**." },
    { type: "items", title: "Seu carrinho" },
    { type: "button", label: "Finalizar compra" },
    { type: "coupon", text: "Use o cupom para ganhar desconto" },
    { type: "recommendations", title: "Você também pode gostar", limit: 4 },
    { type: "signature" },
  ],
};

export async function GET(request: NextRequest) {
  const g = await gate(request);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const [row, brand] = await Promise.all([
    prisma.emailTheme.findUnique({ where: { clienteId: ws } }),
    loadBrandBase(ws),
  ]);
  const published = row?.published ? sanitizeTheme(row.published, brand.base) : null;
  const draft = sanitizeTheme(row?.draft && Object.keys(row.draft as object).length ? row.draft : row?.published ?? {}, brand.base);
  const preview = await previewEmail(ws, DEMO, { draftTheme: true, themeOverride: draft });
  return NextResponse.json({
    draft,
    published,
    base: brand.base,
    fonts: EMAIL_SAFE_FONTS.map((f) => ({ value: f.value, label: f.label })),
    publishedAt: row?.publishedAt?.toISOString() ?? null,
    testedAt: row?.testedAt?.toISOString() ?? null,
    draftUpdatedAt: row?.draftUpdatedAt?.toISOString() ?? null,
    hasUnpublished: Boolean(row?.draftUpdatedAt && (!row.publishedAt || row.draftUpdatedAt > row.publishedAt)),
    previewHtml: preview.html,
  });
}

export async function POST(request: NextRequest) {
  const body = await readBody(request);
  if (!body) return bad("Invalid JSON");
  const action = str(body.action);
  const g = await gate(request, action === "preview" || action === "test" ? "operate" : "manage", body);
  if (!g.ok) return g.response;
  const ws = g.workspaceId;
  const brand = await loadBrandBase(ws);

  if (action === "preview") {
    const theme = sanitizeTheme(body.theme ?? {}, brand.base);
    const r = await previewEmail(ws, body.content ?? DEMO, { themeOverride: theme });
    return NextResponse.json({ html: r.html, bytes: r.bytes, clipped: r.clipped });
  }

  if (action === "save") {
    const theme = sanitizeTheme(body.theme ?? {}, brand.base);
    await prisma.emailTheme.upsert({
      where: { clienteId: ws },
      create: { clienteId: ws, draft: theme as Prisma.InputJsonValue, draftUpdatedAt: new Date() },
      update: { draft: theme as Prisma.InputJsonValue, draftUpdatedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "test") {
    const actor = await flowActor(ws);
    const email = str(body.email) || actor.email || "";
    if (!email) return bad("Informe o e-mail de teste");
    const r = await sendEmailMessage({
      clienteId: ws,
      contact: await sampleContact(ws, email),
      content: DEMO,
      couponCode: "VOLTA10",
      data: {},
      origin: { flowKey: "tema" },
      idempotencyKey: `theme-test-${ws}-${Date.now()}`,
      isTest: true,
      testTo: email,
      draftTheme: true,
    });
    if (r.status !== "SENT") return bad(`Teste não enviado: ${r.reason}`);
    await prisma.emailTheme.upsert({
      where: { clienteId: ws },
      create: { clienteId: ws, testedAt: new Date() },
      update: { testedAt: new Date() },
    });
    return NextResponse.json({ ok: true });
  }

  if (action === "publish") {
    const row = await prisma.emailTheme.findUnique({ where: { clienteId: ws } });
    if (!row) return bad("Salve o tema antes de publicar");
    if (!row.testedAt || (row.draftUpdatedAt && row.testedAt < row.draftUpdatedAt)) {
      return bad("Envie um e-mail de teste da versão atual antes de publicar");
    }
    const actor = await flowActor(ws);
    const prevTone = (row.published as { tone?: string } | null)?.tone;
    const theme = sanitizeTheme(row.draft, brand.base);
    await prisma.emailTheme.update({
      where: { clienteId: ws },
      data: { published: theme as Prisma.InputJsonValue, publishedAt: new Date(), publishedByMemberId: actor.memberId },
    });
    // Tom mudou: reescreve os textos padrão não personalizados
    if (prevTone !== theme.tone) await refreshDefaultCopy(ws, theme.tone).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  if (action === "discard") {
    const row = await prisma.emailTheme.findUnique({ where: { clienteId: ws } });
    await prisma.emailTheme.update({
      where: { clienteId: ws },
      data: { draft: (row?.published ?? {}) as Prisma.InputJsonValue, draftUpdatedAt: null },
    }).catch(() => null);
    return NextResponse.json({ ok: true });
  }

  return bad("Ação inválida");
}
