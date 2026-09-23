import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth-server";
import { SuperAdminShell } from "@/components/layout";

export default async function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const session = await getSession();
  if (!session?.user) redirect("/auth/login");

  const role = (session.user as unknown as { role?: string }).role;
  if (role !== "SUPER_ADMIN") redirect("/dashboard");

  return <SuperAdminShell>{children}</SuperAdminShell>;
}
