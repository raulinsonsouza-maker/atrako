import { redirect } from "next/navigation";

export default function ModulesSocialRedirect() {
  redirect("/atendimento/mensagens?canal=instagram");
}
