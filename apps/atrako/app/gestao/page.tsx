import { redirect } from "next/navigation";

/**
 * Painel de gestão da agência — fora do produto Atrako (cliente final).
 * Mantido só como redirect para não quebrar bookmarks.
 */
export default function GestaoPage() {
  redirect("/assistente");
}
