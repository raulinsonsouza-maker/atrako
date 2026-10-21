import type { Metadata } from "next";
import { headers } from "next/headers";
import { LP_DOMAINS } from "@/lib/lp-domains";

export async function generateMetadata(): Promise<Metadata> {
  const host = ((await headers()).get("host") ?? "").split(":")[0].toLowerCase();
  const brand = LP_DOMAINS[host]?.name;
  return brand ? { title: `Entrar · ${brand}` } : {};
}

export default function SignInLayout({ children }: { children: React.ReactNode }) {
  return children;
}
