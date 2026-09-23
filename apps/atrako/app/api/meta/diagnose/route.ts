import { NextRequest, NextResponse } from "next/server";
import { getIntegrationsConfig } from "@/lib/config/integrations";
import { InternalAuthError, requireInternalUser } from "@/lib/internalUsers";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { META_GRAPH_VERSION } from "@/lib/integrations/meta/graph";

const GRAPH = `https://graph.facebook.com/${META_GRAPH_VERSION}`;

interface PermissionEntry {
  permission: string;
  status: string;
}

interface AdAccount {
  id: string;
  name?: string;
  account_status?: number;
  account_id?: string;
}

interface Page {
  id: string;
  name?: string;
  access_token?: string;
}

export async function GET(request: NextRequest) {
  try {
    await requireInternalUser("ADMIN");
  } catch (error) {
    if (error instanceof InternalAuthError) {
      return NextResponse.json({ error: "Acesso de administrador necessário" }, { status: error.status });
    }
    throw error;
  }

  const clienteId = request.nextUrl.searchParams.get("clienteId")?.trim();
  let token: string | null = null;
  if (clienteId) {
    const resolved = await resolveMetaCredentials(clienteId);
    token = resolved?.token ?? null;
  }
  if (!token) {
    const cfg = await getIntegrationsConfig();
    token = cfg.metaAccessToken ?? process.env.META_ACCESS_TOKEN ?? null;
  }

  if (!token) {
    return NextResponse.json(
      { error: "Meta não conectada (passe clienteId ou configure token legado)" },
      { status: 400 },
    );
  }

  const tk = `access_token=${encodeURIComponent(token)}`;

  const results: Record<string, unknown> = {};

  // 1. /me basic info
  try {
    const r = await fetch(`${GRAPH}/me?${tk}&fields=id,name`);
    const d = await r.json();
    results.me = d;
  } catch (e) {
    results.me = { error: String(e) };
  }

  // 2. /me/permissions
  try {
    const r = await fetch(`${GRAPH}/me/permissions?${tk}`);
    const d = (await r.json()) as { data?: PermissionEntry[]; error?: { message: string } };
    if (d.data) {
      results.permissions = d.data.filter((p) => p.status === "granted").map((p) => p.permission);
      results.permissionsDeclined = d.data.filter((p) => p.status === "declined").map((p) => p.permission);
    } else {
      results.permissionsError = d.error?.message;
    }
  } catch (e) {
    results.permissionsError = String(e);
  }

  // 3. /me/adaccounts — what ad accounts the token can see
  try {
    const r = await fetch(`${GRAPH}/me/adaccounts?${tk}&fields=id,name,account_id,account_status&limit=50`);
    const d = (await r.json()) as { data?: AdAccount[]; error?: { message: string } };
    if (d.data) {
      results.adAccounts = d.data;
    } else {
      results.adAccountsError = d.error?.message;
    }
  } catch (e) {
    results.adAccountsError = String(e);
  }

  // 4. /me/accounts — Pages the token user manages
  try {
    const r = await fetch(`${GRAPH}/me/accounts?${tk}&fields=id,name&limit=50`);
    const d = (await r.json()) as { data?: Page[]; error?: { message: string } };
    if (d.data) {
      results.pages = d.data.map((p) => ({ id: p.id, name: p.name }));
    } else {
      results.pagesError = d.error?.message;
    }
  } catch (e) {
    results.pagesError = String(e);
  }

  // 5. For each page found, try fetching its lead gen forms
  if (Array.isArray(results.pages) && (results.pages as Page[]).length > 0) {
    const pageForms: Record<string, unknown> = {};
    for (const page of results.pages as Page[]) {
      try {
        const r = await fetch(`${GRAPH}/${page.id}/leadgen_forms?${tk}&fields=id,name,status&limit=10`);
        const d = (await r.json()) as { data?: unknown[]; error?: { message: string } };
        if (d.data) {
          pageForms[`${page.id} (${page.name})`] = d.data;
        } else {
          pageForms[`${page.id} (${page.name})`] = { error: d.error?.message };
        }
      } catch (e) {
        pageForms[`${page.id} (${page.name})`] = { error: String(e) };
      }
    }
    results.pageLeadForms = pageForms;
  }

  return NextResponse.json(results);
}
