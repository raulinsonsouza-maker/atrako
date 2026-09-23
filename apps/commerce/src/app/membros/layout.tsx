import { MembersShell } from "@/components/shells/MembersShell";
import { requireBuyer } from "@/lib/session";

export default async function MembrosLayout({ children }: { children: React.ReactNode }) {
  await requireBuyer();
  return <MembersShell>{children}</MembersShell>;
}
