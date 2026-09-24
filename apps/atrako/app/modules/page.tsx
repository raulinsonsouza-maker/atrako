import { redirect } from "next/navigation";

/** Hub legado /modules → assistente. */
export default function ModulesHubRedirect() {
  redirect("/assistente");
}
