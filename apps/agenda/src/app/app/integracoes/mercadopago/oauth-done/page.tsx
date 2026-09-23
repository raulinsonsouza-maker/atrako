"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

export default function MercadoPagoOAuthDonePage() {
  const router = useRouter();

  useEffect(() => {
    const status =
      new URLSearchParams(window.location.search).get("mp") || "error";
    const payload = { type: "mercadopago-oauth", status };

    if (window.opener && !window.opener.closed) {
      window.opener.postMessage(payload, window.location.origin);
      window.close();
      return;
    }

    router.replace(`/app/integracoes/mercadopago?mp=${status}`);
  }, [router]);

  return (
    <div className="flex min-h-[40vh] items-center justify-center p-6">
      <p className="text-sm text-muted">Finalizando conexão…</p>
    </div>
  );
}
