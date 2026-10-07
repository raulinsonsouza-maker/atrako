import "server-only";
import { NextResponse } from "next/server";
import {
  assertCanManageConfig,
  assertCanOperateWorkspace,
  getActiveWorkspaceId,
  requireWorkspaceAccess,
} from "@/lib/tenancy/workspace";
import { requireModuleApi } from "@/lib/modules/resolve";
import type { AtrakoActor } from "./context";

export type AssistantSession = { workspaceId: string; actor: AtrakoActor };

/** Workspace ativo + quem está falando com o Atrako (conversas são por pessoa). */
export async function resolveAssistantSession(): Promise<
  { ok: true; session: AssistantSession } | { ok: false; response: NextResponse }
> {
  const workspaceId = await getActiveWorkspaceId();
  if (!workspaceId) {
    return { ok: false, response: NextResponse.json({ error: "Nenhum workspace ativo" }, { status: 401 }) };
  }
  const access = await requireWorkspaceAccess(workspaceId, "operate");
  if (!access.ok) return { ok: false, response: access.response };
  const off = await requireModuleApi(workspaceId, "assistente");
  if (off) return { ok: false, response: off };

  const who = await assertCanOperateWorkspace(workspaceId);
  const canManage = await assertCanManageConfig(workspaceId).then(
    () => true,
    () => false,
  );
  const actor: AtrakoActor =
    who.kind === "member"
      ? { kind: "member", key: `member:${who.member.id}`, name: who.member.name ?? null, role: who.member.role, canManage }
      : {
          kind: "platform",
          key: `internal:${who.user.id}`,
          name: who.user.name ?? who.user.username ?? null,
          role: who.user.role === "ADMIN" ? "admin da plataforma" : "analista da plataforma",
          canManage,
        };
  return { ok: true, session: { workspaceId, actor } };
}
