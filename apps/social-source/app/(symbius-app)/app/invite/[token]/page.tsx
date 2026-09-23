"use client";

import { useRouter, useParams } from "next/navigation";
import { useState } from "react";

export default function InviteAcceptPage() {
  const router = useRouter();
  const params = useParams();
  const token = String(params.token ?? "");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function accept() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/symbius/members/accept", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token }),
    });
    setBusy(false);
    if (res.ok) {
      router.push("/app");
      router.refresh();
    } else {
      const d = await res.json();
      setError(d.error ?? "Erro ao aceitar convite");
    }
  }

  return (
    <div className="symbius-light flex min-h-screen items-center justify-center bg-[#f4f5f7] p-6">
      <div className="w-full max-w-md rounded-2xl border border-zinc-200 bg-white p-8 text-center">
        <h1 className="text-xl font-bold">Convite para equipe</h1>
        <p className="mt-2 text-sm text-zinc-500">
          Aceite para entrar no workspace Symbius.
        </p>
        {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
        <button
          type="button"
          disabled={busy}
          onClick={() => void accept()}
          className="symbius-btn-primary mt-6 w-full py-2.5"
        >
          Aceitar convite
        </button>
      </div>
    </div>
  );
}
