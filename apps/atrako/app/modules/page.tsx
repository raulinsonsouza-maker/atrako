import { redirect } from "next/navigation";

/** Hub legado /modules → home do agente. */
export default function ModulesHubRedirect() {
  redirect("/");
}
