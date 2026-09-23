"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { ClienteDashboard } from "@/app/clientes/[id]/ClienteDashboard";

function PortalNotFound() {
  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--muted)]">
        <svg
          className="h-8 w-8 text-[var(--muted-foreground)]"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-bold text-[var(--foreground)]">Acesso não encontrado</h1>
        <p className="mt-2 max-w-sm text-sm text-[var(--muted-foreground)]">
          Este link de acesso não é válido ou foi desativado. Solicite um novo link à sua agência.
        </p>
      </div>
    </div>
  );
}

export default function PortalPage() {
  const params = useParams();
  const token = params.token as string;
  const [clienteId, setClienteId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/portal/${token}`)
      .then((r) => {
        if (!r.ok) {
          setNotFound(true);
          setLoading(false);
          return null;
        }
        return r.json();
      })
      .then((data) => {
        if (!data) return;
        setClienteId(data.clienteId);
        setLoading(false);
      })
      .catch(() => {
        setNotFound(true);
        setLoading(false);
      });
  }, [token]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
      </div>
    );
  }

  if (notFound || !clienteId) {
    return <PortalNotFound />;
  }

  return <ClienteDashboard id={clienteId} portalMode />;
}
