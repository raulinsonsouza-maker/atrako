import { prisma } from "@/lib/db";

/**
 * No shell operacional, `Cliente` é o tenant Atrako.
 * `Cliente.id` === `workspaceId` nos contratos `@atrako/events` e `@atrako/db`.
 */
export type WorkspaceRef = {
  id: string;
  name: string;
  slug: string;
};

export async function findWorkspaceById(workspaceId: string): Promise<WorkspaceRef | null> {
  const cliente = await prisma.cliente.findUnique({
    where: { id: workspaceId },
    select: { id: true, nome: true, slug: true },
  });
  if (!cliente) return null;
  return { id: cliente.id, name: cliente.nome, slug: cliente.slug };
}

export async function requireWorkspace(workspaceId: string): Promise<WorkspaceRef> {
  const workspace = await findWorkspaceById(workspaceId);
  if (!workspace) {
    throw new Error(`Workspace not found: ${workspaceId}`);
  }
  return workspace;
}
