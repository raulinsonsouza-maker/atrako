import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@/lib/generated/prisma";
import { prisma } from "@/lib/db";
import { getCrmAdapter } from "@/lib/crm/factory";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  const config = await prisma.crmConfig.findUnique({ where: { clienteId: id } });
  if (!config) return NextResponse.json(null);

  const creds = config.credenciais as Record<string, unknown>;
  const safeCredenciais: Record<string, unknown> = {};
  if (creds.clientId) safeCredenciais.clientId = creds.clientId;
  if (creds.clientSecret) safeCredenciais.clientSecret = creds.clientSecret;
  if (creds.email) safeCredenciais.email = creds.email;
  if (creds.token) safeCredenciais.token = creds.token;
  safeCredenciais.connected = !!(creds.accessToken);
  if (Array.isArray(creds.tagFilter)) safeCredenciais.tagFilter = creds.tagFilter;
  if (Array.isArray(creds.midiaFilter)) safeCredenciais.midiaFilter = creds.midiaFilter;
  if (Array.isArray(creds.origemOriginalFilter))
    safeCredenciais.origemOriginalFilter = creds.origemOriginalFilter;
  if (Array.isArray(creds.origemUltimoFilter))
    safeCredenciais.origemUltimoFilter = creds.origemUltimoFilter;
  if (Array.isArray(creds.conversaoOriginalFilter))
    safeCredenciais.conversaoOriginalFilter = creds.conversaoOriginalFilter;
  if (Array.isArray(creds.conversaoUltimoFilter))
    safeCredenciais.conversaoUltimoFilter = creds.conversaoUltimoFilter;
  if (Array.isArray(creds.allowedSources))
    safeCredenciais.allowedSources = creds.allowedSources;
  if (Array.isArray(creds.allowedStages))
    safeCredenciais.allowedStages = creds.allowedStages;

  return NextResponse.json({
    id: config.id,
    clienteId: config.clienteId,
    tipo: config.tipo,
    dominio: config.dominio,
    ativo: config.ativo,
    ultimoSyncAt: config.ultimoSyncAt,
    credenciais: safeCredenciais,
  });
}

export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  let body: {
    tipo?: string;
    dominio?: string | null;
    credenciais?: Record<string, unknown>;
    ativo?: boolean;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  if (!body.tipo) {
    const deleted = await prisma.crmConfig.deleteMany({ where: { clienteId: id } });
    return NextResponse.json({ deleted: deleted.count });
  }

  const validTypes = ["CVCRM", "RDSTATION_CRM", "KOMMO", "EXACT_SPOTTER"];
  if (!validTypes.includes(body.tipo)) {
    return NextResponse.json({ error: "Tipo CRM inválido" }, { status: 400 });
  }

  let credenciais: Record<string, unknown> = body.credenciais ?? {};

  if (body.tipo === "RDSTATION_CRM") {
    const existing = await prisma.crmConfig.findUnique({ where: { clienteId: id } });
    if (existing?.tipo === "RDSTATION_CRM") {
      const prev = existing.credenciais as Record<string, unknown>;
      credenciais = {
        ...prev,
        ...(credenciais.clientId ? { clientId: credenciais.clientId } : {}),
        ...(credenciais.clientSecret ? { clientSecret: credenciais.clientSecret } : {}),
      };
    }
  } else if (body.tipo === "CVCRM") {
    // Merge over existing creds so saving the form never wipes fields it
    // doesn't manage (e.g. tokens, future config keys).
    const existing = await prisma.crmConfig.findUnique({ where: { clienteId: id } });
    if (existing?.tipo === "CVCRM") {
      const prev = existing.credenciais as Record<string, unknown>;
      credenciais = { ...prev, ...credenciais };
    }
  }

  const config = await prisma.crmConfig.upsert({
    where: { clienteId: id },
    create: {
      clienteId: id,
      tipo: body.tipo as "CVCRM" | "RDSTATION_CRM" | "KOMMO" | "EXACT_SPOTTER",
      dominio: body.dominio ?? null,
      credenciais: credenciais as Prisma.InputJsonValue,
      ativo: body.ativo ?? true,
    },
    update: {
      tipo: body.tipo as "CVCRM" | "RDSTATION_CRM" | "KOMMO" | "EXACT_SPOTTER",
      dominio: body.dominio ?? null,
      credenciais: credenciais as Prisma.InputJsonValue,
      ativo: body.ativo ?? true,
    },
  });

  return NextResponse.json({ ok: true, id: config.id });
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;
  await prisma.crmConfig.deleteMany({ where: { clienteId: id } });
  return NextResponse.json({ ok: true });
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> },
) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const { id } = await params;

  const url = new URL(request.url);
  const action = url.searchParams.get("action");

  if (action === "test") {
    let draftConfig: {
      tipo?: string;
      dominio?: string | null;
      credenciais?: Record<string, string>;
    } | null = null;

    try {
      const body = await request.json();
      if (body && body.tipo) draftConfig = body;
    } catch {
      /* fall back to saved config */
    }

    try {
      let adapterConfig: { id?: string; tipo: string; dominio?: string | null; credenciais: unknown };

      if (draftConfig?.tipo) {
        adapterConfig = {
          tipo: draftConfig.tipo,
          dominio: draftConfig.dominio ?? null,
          credenciais: draftConfig.credenciais ?? {},
        };
      } else {
        const saved = await prisma.crmConfig.findUnique({ where: { clienteId: id } });
        if (!saved) {
          return NextResponse.json({ ok: false, error: "CRM não configurado" }, { status: 404 });
        }
        adapterConfig = saved;
      }

      const adapter = await getCrmAdapter(adapterConfig);
      const result = await adapter.testConnection();
      return NextResponse.json(result);
    } catch (e) {
      return NextResponse.json({ ok: false, error: e instanceof Error ? e.message : String(e) });
    }
  }

  return NextResponse.json({ error: "Ação não reconhecida" }, { status: 400 });
}
