import { NextResponse } from "next/server";
import { findWorkspaceById } from "@/lib/atrako/workspace";
import { requireWorkspaceAccess } from "@/lib/tenancy/workspace";

export async function requireWorkspace(workspaceId: string | null | undefined) {
  const id = typeof workspaceId === "string" ? workspaceId.trim() : "";
  if (!id) {
    return {
      error: NextResponse.json({ error: "workspaceId required" }, { status: 400 }),
    } as const;
  }
  const access = await requireWorkspaceAccess(id, "operate");
  if (!access.ok) return { error: access.response } as const;
  if (!(await findWorkspaceById(id))) {
    return {
      error: NextResponse.json({ error: "not found" }, { status: 404 }),
    } as const;
  }
  return { workspaceId: id } as const;
}

export function jsonError(message: string, status = 400) {
  return NextResponse.json({ error: message }, { status });
}
