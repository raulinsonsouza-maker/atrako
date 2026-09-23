import { NextRequest, NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";
import { resolveMetaCredentials } from "@/lib/config/resolveIntegracao";
import { ensureActPrefix, metaGraphPostForm } from "@/lib/integrations/meta/graph";
import { metaGraphGet } from "@/lib/integrations/meta/graph";

/** Upload de vídeo para Meta Ads + poll de processamento. */
export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => ({}))) as {
    workspaceId?: string;
    adAccountId?: string;
    filename?: string;
    /** URL pública do vídeo OU file_url já hospedado */
    fileUrl?: string;
    title?: string;
  };
  const workspaceId = body.workspaceId?.trim();
  const adAccountId = body.adAccountId?.trim();
  const fileUrl = body.fileUrl?.trim();
  if (!workspaceId || !adAccountId || !fileUrl) {
    return NextResponse.json(
      { error: "workspaceId, adAccountId e fileUrl obrigatórios" },
      { status: 400 },
    );
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return access.response;
  if (!(await findWorkspaceById(workspaceId))) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const creds = await resolveMetaCredentials(workspaceId);
  if (!creds?.token) {
    return NextResponse.json({ error: "Meta não conectada" }, { status: 503 });
  }

  const act = ensureActPrefix(adAccountId);
  try {
    const created = await metaGraphPostForm(`/${act}/advideos`, creds.token, {
      file_url: fileUrl,
      title: body.title || body.filename || "video",
    });
    const videoId = String(created.id || "");
    if (!videoId) throw new Error("Meta não retornou video_id");

    // Poll status até ready ou timeout curto
    let status = "processing";
    for (let i = 0; i < 8; i++) {
      await new Promise((r) => setTimeout(r, 1500));
      const info = await metaGraphGet(`/${videoId}`, creds.token, {
        fields: "status,title",
      });
      const st = info.status as { video_status?: string } | string | undefined;
      const vs =
        typeof st === "string"
          ? st
          : st && typeof st === "object"
            ? st.video_status
            : undefined;
      if (vs === "ready" || vs === "upload_complete") {
        status = "ready";
        break;
      }
      if (vs === "error") {
        status = "error";
        break;
      }
    }

    return NextResponse.json({ videoId, status });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : String(e) },
      { status: 502 },
    );
  }
}
