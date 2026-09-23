import { requireAdmin } from "@/lib/session";
import { AdminShell } from "@/components/shells/AdminShell";
import { ReactNode } from "react";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  await requireAdmin();
  return <AdminShell>{children}</AdminShell>;
}
