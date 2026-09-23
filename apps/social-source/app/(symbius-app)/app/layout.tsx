import "../../symbius.css";
import { redirect } from "next/navigation";
import { getSession } from "@/lib/symbius/auth";
import { getSymbiusShellData } from "@/lib/symbius/shellData";
import { SymbiusAppShell } from "@/components/symbius/SymbiusAppShell";

export default async function SymbiusAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await getSession();
  if (!session) redirect("/login");

  const shell = await getSymbiusShellData(session);

  return <SymbiusAppShell shell={shell}>{children}</SymbiusAppShell>;
}
