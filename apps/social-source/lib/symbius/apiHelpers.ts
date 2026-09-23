import { NextResponse } from "next/server";
import { getSession, type SymbiusSession } from "./auth";
import { assertOrgAccess } from "./tenant";

export async function requireApiSession(
  minRole: "AGENT" | "ADMIN" | "OWNER" = "AGENT",
): Promise<SymbiusSession | NextResponse> {
  const session = await getSession();
  if (!session) {
    return NextResponse.json({ error: "Não autenticado" }, { status: 401 });
  }
  try {
    await assertOrgAccess(session, minRole);
  } catch {
    return NextResponse.json({ error: "Sem permissão" }, { status: 403 });
  }
  return session;
}

export function isSession(
  value: SymbiusSession | NextResponse,
): value is SymbiusSession {
  return "organizationId" in value;
}
