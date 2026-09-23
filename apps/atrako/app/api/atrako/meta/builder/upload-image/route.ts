import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { uploadAdImage } from "@/lib/integrations/meta/campaign-builder/publish";

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    adAccountId?: string;
    filename?: string;
    base64?: string;
  };
  const workspaceId = body.workspaceId?.trim();
  const adAccountId = body.adAccountId?.trim();
  const filename = body.filename?.trim() || "image.jpg";
  const base64 = body.base64?.trim();
  if (!workspaceId || !adAccountId || !base64) {
    return NextResponse.json(
      { error: "workspaceId, adAccountId e base64 obrigatórios" },
      { status: 400 },
    );
  }
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  try {
    // strip data URL prefix if present
    const raw = base64.includes(",") ? base64.split(",")[1] : base64;
    const result = await uploadAdImage({
      clienteId: workspaceId,
      adAccountId,
      filename,
      base64: raw,
    });
    return NextResponse.json(result);
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
