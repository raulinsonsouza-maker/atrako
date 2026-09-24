import { redirect } from "next/navigation";

/** Alias legado /agent → assistente. */
export default function AgentAliasPage() {
  redirect("/assistente");
}
