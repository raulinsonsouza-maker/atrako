import { notFound } from "next/navigation";

/** Qualquer endereço desconhecido do domínio do cliente cai aqui → 404 com a marca. */
export default function GeoUnknownPage() {
  notFound();
}
