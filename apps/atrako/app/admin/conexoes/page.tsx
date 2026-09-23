import { redirect } from "next/navigation";

/** Alias legado — fonte única é /config/conexoes. */
export default function AdminConexoesRedirect() {
  redirect("/config/conexoes");
}
