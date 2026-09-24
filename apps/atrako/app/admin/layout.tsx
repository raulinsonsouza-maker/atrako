import { redirect } from "next/navigation";
import { AdminShell } from "@/components/layout/AdminShell";
import { getInternalUser } from "@/lib/internalUsers";

/** Staff ADMIN only. Member-only sessions redirect home.
 *  ATRAKO_DEV_OPEN_ACCESS=1 yields a synthetic ADMIN via getInternalUser. */
export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const user = await getInternalUser();
  if (!user || !user.active || user.role !== "ADMIN") {
    redirect("/assistente");
  }

  const openAccess = user.id === "atrako-open-access";

  return (
    <AdminShell
      identity={{
        username: user.username || "staff",
        role: user.role,
        openAccess,
      }}
    >
      {children}
    </AdminShell>
  );
}
