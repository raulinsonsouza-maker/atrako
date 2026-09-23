"use client";

import { usePathname } from "next/navigation";
import { Header } from "@/components/layout/Header";

const CENTRAL_PREFIXES = [
  "/clientes",
  "/admin",
  "/gestao",
  "/planejamento",
  "/portal",
];

export function LayoutRouter({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isCentral = CENTRAL_PREFIXES.some((p) => pathname.startsWith(p));

  if (isCentral) {
    return (
      <>
        <Header />
        <div className="container mx-auto px-4 py-6">{children}</div>
      </>
    );
  }

  return <>{children}</>;
}
