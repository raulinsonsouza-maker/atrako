"use client";

import { useEffect } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Suspense } from "react";

function Inner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  useEffect(() => {
    const qs = searchParams.toString();
    router.replace(
      `/app/integracoes/mercadopago/oauth-done${qs ? `?${qs}` : ""}`,
    );
  }, [router, searchParams]);
  return <p className="text-sm text-muted">Redirecionando…</p>;
}

export default function MercadoPagoOauthRedirectPage() {
  return (
    <Suspense fallback={<p className="text-sm text-muted">Redirecionando…</p>}>
      <Inner />
    </Suspense>
  );
}
