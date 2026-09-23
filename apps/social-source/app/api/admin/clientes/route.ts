import { NextRequest, NextResponse } from "next/server";
import { createCliente, findAllClientes, findClienteById } from "@/lib/repositories/clientesRepository";
import {
  PLATAFORMA_GOOGLE_ADS,
  PLATAFORMA_META,
  PLATAFORMA_GOOGLE_ANALYTICS,
  PLATAFORMA_INSTAGRAM,
  upsertContaPlataforma,
} from "@/lib/repositories/contasRepository";
import { slugify } from "@/lib/admin/slugify";
import { syncClienteCanais } from "@/lib/sync/syncClienteCanais";

function isAdminAuthorized(request: NextRequest): boolean {
  const token = request.headers.get("x-admin-token") ?? request.nextUrl.searchParams.get("token");
  const expected = process.env.ADMIN_SECRET;
  if (!expected) return true;
  return token === expected;
}

export async function GET(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  try {
    const clientes = await findAllClientes(false);
    return NextResponse.json(clientes);
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAdminAuthorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  let body: {
    nome?: string;
    slug?: string;
    logoUrl?: string;
    segmento?: string;
    ativo?: boolean;
    syncAfterCreate?: boolean;
    orcamentoMidiaGoogleMensal?: number;
    orcamentoMidiaMetaMensal?: number;
    googleAdsAccountId?: string | null;
    googleAdsLoginCustomerId?: string | null;
    metaAdsAccountId?: string | null;
    instagramBusinessAccountId?: string | null;
    ga4PropertyId?: string | null;
    conexaoMetaId?: string | null;
    conexaoGoogleId?: string | null;
    leadScoringEnabled?: boolean;
    socialMediaAtivo?: boolean;
    perfilPanel?: string | null;
    squad?: number | null;
  };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }
  const nome = body.nome?.trim();
  if (!nome) {
    return NextResponse.json({ error: "nome é obrigatório" }, { status: 400 });
  }
  const slug = body.slug?.trim() || slugify(nome);
  if (!slug) {
    return NextResponse.json({ error: "slug não pôde ser gerado a partir do nome" }, { status: 400 });
  }

  try {
    const cliente = await createCliente({
      nome,
      slug,
      logoUrl: body.logoUrl || null,
      segmento: body.segmento?.trim() || null,
      ativo: body.ativo ?? true,
      orcamentoMidiaGoogleMensal: body.orcamentoMidiaGoogleMensal ?? null,
      orcamentoMidiaMetaMensal: body.orcamentoMidiaMetaMensal ?? null,
      leadScoringEnabled: body.leadScoringEnabled ?? false,
      socialMediaAtivo: body.socialMediaAtivo ?? false,
      perfilPanel: body.perfilPanel?.trim() || null,
      squad: body.squad === 1 || body.squad === 2 || body.squad === 3 ? body.squad : null,
    });

    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_GOOGLE_ADS,
      accountIdPlataforma: body.googleAdsAccountId,
      googleAdsLoginCustomerId: body.googleAdsLoginCustomerId,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoGoogleId ?? null,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_META,
      accountIdPlataforma: body.metaAdsAccountId,
      nomeConta: nome,
      conexaoIntegracaoId: body.conexaoMetaId ?? null,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_GOOGLE_ANALYTICS,
      accountIdPlataforma: body.ga4PropertyId,
      nomeConta: nome,
    });
    await upsertContaPlataforma({
      clienteId: cliente.id,
      plataforma: PLATAFORMA_INSTAGRAM,
      accountIdPlataforma: body.instagramBusinessAccountId ?? null,
      nomeConta: nome,
    });

    const syncAfterCreate = body.syncAfterCreate ?? true;
    let syncResult = null;
    if (syncAfterCreate && (body.ativo ?? true)) {
      syncResult = await syncClienteCanais(cliente.id);
    }

    const clienteWithContas = await findClienteById(cliente.id);

    return NextResponse.json({
      cliente: clienteWithContas ?? cliente,
      sync: syncResult,
      dashboardReady: !!(syncResult && syncResult.ok),
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : String(e);
    if (message.includes("Unique constraint")) {
      return NextResponse.json({ error: "Já existe um cliente com esse slug." }, { status: 409 });
    }
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
