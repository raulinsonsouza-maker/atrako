import { readFile } from "node:fs/promises";
import path from "node:path";
import { redirect } from "next/navigation";
import { getInternalUser } from "@/lib/internalUsers";
import { getWorkspaceMember } from "@/lib/tenancy/memberAuth";

export const dynamic = "force-dynamic";

/**
 * Index pública: site institucional estático (`public/site/index.html`).
 * Sessão autenticada redireciona para a área certa.
 */
export async function GET() {
  const [internal, member] = await Promise.all([getInternalUser(), getWorkspaceMember()]);

  if (internal && internal.id !== "atrako-open-access" && internal.active) {
    if (internal.mustChangePassword) redirect("/change-password");
    if (internal.role === "ADMIN") redirect("/admin/clientes");
    redirect("/assistente");
  }
  if (member) redirect("/assistente");

  const html = await readFile(path.join(process.cwd(), "public", "site", "index.html"), "utf8");
  return new Response(html, {
    headers: { "content-type": "text/html; charset=utf-8", "cache-control": "private, no-store" },
  });
}
