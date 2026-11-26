"use client";

import { useEffect } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useModules } from "@/hooks/useModules";

/** Em workspace ecommerce, /crm cai no shell da loja. */
export function CrmEcommerceRedirect({ children }: { children: React.ReactNode }) {
  const { edition, isReady } = useModules();
  const router = useRouter();
  const pathname = usePathname();
  const search = useSearchParams();

  useEffect(() => {
    if (!isReady || edition !== "ecommerce") return;
    const qs = search.toString();
    const target =
      pathname.startsWith("/crm/leads/")
        ? `/commerce/leads?lead=${encodeURIComponent(pathname.split("/").pop() || "")}`
        : `/commerce/leads${qs ? `?${qs}` : ""}`;
    router.replace(target);
  }, [edition, isReady, pathname, router, search]);

  if (isReady && edition === "ecommerce") {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <p className="type-caption text-[var(--ink-muted-48)]">Abrindo Leads na loja…</p>
      </div>
    );
  }

  return children;
}
