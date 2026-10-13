import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";

export type StayPanelRole = "OWNER" | "ADMIN" | "OPERATOR";

export async function stayPanelRole(workspaceId: string): Promise<StayPanelRole> {
  const member = await getWorkspaceMember();
  if (!member || member.clienteId !== workspaceId) return "ADMIN";
  if (member.role === "OPERATOR") return "OPERATOR";
  if (member.role === "OWNER") return "OWNER";
  return "ADMIN";
}

export function stayCanManage(role: StayPanelRole) {
  return role === "OWNER" || role === "ADMIN";
}
