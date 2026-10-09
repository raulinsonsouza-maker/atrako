import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";

export type FoodPanelRole = "OWNER" | "ADMIN" | "OPERATOR";

export async function foodPanelRole(workspaceId: string): Promise<FoodPanelRole> {
  const member = await getWorkspaceMember();
  if (!member || member.clienteId !== workspaceId) return "ADMIN";
  if (member.role === "OPERATOR") return "OPERATOR";
  if (member.role === "OWNER") return "OWNER";
  return "ADMIN";
}

export function foodCanManage(role: FoodPanelRole) {
  return role === "OWNER" || role === "ADMIN";
}
