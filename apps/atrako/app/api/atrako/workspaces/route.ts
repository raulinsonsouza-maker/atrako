import { NextRequest, NextResponse } from "next/server";
import { createCliente } from "@/lib/repositories/clientesRepository";
import { slugify } from "@/lib/admin/slugify";
import { ensureWorkspaceSettings } from "@/lib/config/getWorkspaceConfig";
import { getInternalUser } from "@/lib/internalUsers";
import { prisma } from "@/lib/db";

/** Cria empresa (workspace) pelo fluxo de produto — sem passar pelo Admin. */
export async function POST(request: NextRequest) {
  const user = await getInternalUser();
  if (!user?.active) {
    return NextResponse.json({ error: "Não autorizado" }, { status: 401 });
  }

  let body: { nome?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "JSON inválido" }, { status: 400 });
  }

  const nome = body.nome?.trim();
  if (!nome) {
    return NextResponse.json({ error: "Nome obrigatório" }, { status: 400 });
  }

  const baseSlug = slugify(nome);
  if (!baseSlug) {
    return NextResponse.json({ error: "Nome inválido" }, { status: 400 });
  }

  let slug = baseSlug;
  for (let i = 0; i < 8; i++) {
    const taken = await prisma.cliente.findUnique({
      where: { slug },
      select: { id: true },
    });
    if (!taken) break;
    slug = `${baseSlug}-${i + 2}`;
  }

  try {
    const cliente = await createCliente({ nome, slug, ativo: true });
    await ensureWorkspaceSettings(cliente.id);

    if (user.email && user.id !== "atrako-open-access") {
      await prisma.workspaceMember.upsert({
        where: {
          clienteId_email: { clienteId: cliente.id, email: user.email },
        },
        create: {
          clienteId: cliente.id,
          email: user.email,
          name: user.name,
          role: "OWNER",
          active: true,
        },
        update: { role: "OWNER", active: true, name: user.name },
      });
    }

    return NextResponse.json({
      id: cliente.id,
      nome: cliente.nome,
      slug: cliente.slug,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
