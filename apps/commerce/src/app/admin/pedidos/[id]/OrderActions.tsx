"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function OrderActions({
  orderId,
  canRefund,
}: {
  orderId: string;
  canRefund: boolean;
}) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState<"refund" | "resend" | null>(null);

  async function refund() {
    if (!confirm("Confirmar reembolso deste pedido?")) return;
    setLoading("refund");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/orders/${orderId}/refund`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Falha no reembolso.");
      return;
    }
    setMessage("Pedido reembolsado e acessos revogados.");
    router.refresh();
  }

  async function resend() {
    setLoading("resend");
    setError(null);
    setMessage(null);
    const res = await fetch(`/api/admin/orders/${orderId}/resend`, { method: "POST" });
    const data = await res.json().catch(() => ({}));
    setLoading(null);
    if (!res.ok) {
      setError(data.error ?? "Falha ao reenviar acesso.");
      return;
    }
    setMessage("E-mail de acesso reenviado.");
  }

  return (
    <div className="stack-sm">
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {message ? <Alert tone="success">{message}</Alert> : null}
      <div className="cluster gap-3">
        {canRefund ? (
          <Button
            type="button"
            variant="danger"
            disabled={loading !== null}
            onClick={refund}
          >
            {loading === "refund" ? "Reembolsando…" : "Reembolsar"}
          </Button>
        ) : null}
        <Button
          type="button"
          variant="secondary"
          disabled={loading !== null}
          onClick={resend}
        >
          {loading === "resend" ? "Enviando…" : "Reenviar acesso"}
        </Button>
      </div>
    </div>
  );
}
