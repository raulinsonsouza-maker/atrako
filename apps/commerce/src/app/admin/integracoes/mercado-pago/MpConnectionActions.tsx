"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function MpConnectionActions({ connected }: { connected: boolean }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function disconnect() {
    setError(null);
    setLoading(true);
    const res = await fetch("/api/mp/oauth/disconnect", { method: "POST" });
    setLoading(false);
    if (!res.ok) {
      setError("Não foi possível desconectar.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="stack-sm">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <div className="cluster gap-3">
        <a href="/api/mp/oauth/start">
          <Button type="button">{connected ? "Reconectar" : "Conectar Mercado Pago"}</Button>
        </a>
        {connected ? (
          <Button type="button" variant="danger" disabled={loading} onClick={disconnect}>
            {loading ? "Desconectando…" : "Desconectar"}
          </Button>
        ) : null}
      </div>
    </div>
  );
}
