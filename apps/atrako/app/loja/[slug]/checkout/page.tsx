"use client";

import { use } from "react";
import { useQuery } from "@tanstack/react-query";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { StoreCheckout } from "@/components/commerce/StoreCheckout";

export default function StoreCheckoutPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = use(params);
  const { data, isLoading, error } = useQuery({
    queryKey: ["store-public", slug],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/public/${slug}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        store: {
          id: string;
          slug: string;
          name: string;
          shipEnabled: boolean;
          pickupEnabled: boolean;
        };
        brand: { primaryColor?: string | null } | null;
      }>;
    },
  });

  if (isLoading) return <p className="p-8 type-caption">Carregando…</p>;
  if (error || !data) return <p className="p-8 type-body">Checkout indisponível.</p>;

  return (
    <BrandThemeScope
      primaryColor={data.brand?.primaryColor}
      className="min-h-dvh bg-[var(--canvas-parchment)] px-4 py-8"
    >
      <StoreCheckout
        storeId={data.store.id}
        storeSlug={data.store.slug}
        storeName={data.store.name}
        shipEnabled={data.store.shipEnabled}
        pickupEnabled={data.store.pickupEnabled}
      />
    </BrandThemeScope>
  );
}
