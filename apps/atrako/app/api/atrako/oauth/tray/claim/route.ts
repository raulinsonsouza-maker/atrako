import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { connectTrayStore } from "@/lib/integrations/tray/connect";

const bodySchema = z.object({
  workspaceId: z.string().trim().min(1),
  code: z.string().trim().min(1),
  apiAddress: z.string().trim().min(1),
  store: z.string().trim().optional().nullable(),
});

const ERROR_MESSAGES: Record<string, string> = {
  tray_api_address_invalid: "Endereço da API da loja inválido.",
  tray_not_configured: "App Tray não configurado em /admin/apps.",
  tray_token_failed:
    "A Tray recusou o código de instalação. Reinstale o app pelo painel da loja.",
};

/** Vincula uma instalação feita no painel da Tray (sem state) a uma empresa. */
export async function POST(request: NextRequest) {
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: "Dados de instalação incompletos." }, { status: 400 });
  }
  const { workspaceId, code, apiAddress, store } = parsed.data;

  const access = await requireWorkspaceAccess(workspaceId, "manage");
  if (!access.ok) return access.response;
  const ws = await findWorkspaceById(workspaceId);
  if (!ws) return NextResponse.json({ error: "Empresa não encontrada." }, { status: 404 });

  const result = await connectTrayStore({ clienteId: workspaceId, code, apiAddress, store });
  if (!result.ok) {
    return NextResponse.json(
      { error: ERROR_MESSAGES[result.error] ?? result.error, code: result.error },
      { status: result.error === "tray_not_configured" ? 503 : 400 },
    );
  }
  return NextResponse.json({ ok: true, storeId: result.storeId, storeHost: result.storeHost });
}
