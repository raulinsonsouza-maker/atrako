"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Image from "next/image";
import { Loader2 } from "lucide-react";
import { BrandThemeScope } from "@/components/brand/BrandThemeScope";
import { brl } from "@/components/agenda/agenda-shared";
import { Button } from "@/components/ui/button";

type CheckoutPayload = {
  link: { title: string; accentColor: string; logoUrl: string | null };
  product: { title: string; description: string | null; priceCents: number };
  workspace: { name: string };
  onlinePayment: boolean;
};

export default function PublicAgendaCheckoutPage() {
  const params = useParams();
  const linkSlug = params.linkSlug as string;
  const [data, setData] = useState<CheckoutPayload | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [done, setDone] = useState(false);
  const [pixQr, setPixQr] = useState<string | null>(null);
  const [pixB64, setPixB64] = useState<string | null>(null);
  const [instructions, setInstructions] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    customerName: "",
    customerEmail: "",
    customerPhone: "",
  });

  useEffect(() => {
    (async () => {
      try {
        const r = await fetch(`/api/atrako/agenda/public/checkout/${linkSlug}`);
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || "Não encontrado");
        setData(j);
      } catch (e) {
        setError(e instanceof Error ? e.message : "Erro");
      } finally {
        setLoading(false);
      }
    })();
  }, [linkSlug]);

  async function pay() {
    if (!data) return;
    setSubmitting(true);
    setError("");
    try {
      const r = await fetch(`/api/atrako/agenda/public/checkout/${linkSlug}/pay`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha");

      if (j.status === "CONFIRMED") {
        setDone(true);
        if (j.instructions) setInstructions(j.instructions);
        return;
      }
      setPixQr(j.qrCode ?? null);
      setPixB64(j.qrCodeBase64 ?? null);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="mx-auto max-w-md px-5 py-16 text-center type-body text-[var(--ink-muted-80)]">
        {error}
      </div>
    );
  }

  if (!data) return null;

  return (
    <BrandThemeScope primaryColor={data.link.accentColor} className="min-h-screen bg-[var(--canvas)]">
      <div className="mx-auto max-w-md px-5 py-10">
        <header className="mb-8 text-center">
          {data.link.logoUrl ? (
            <Image
              src={data.link.logoUrl}
              alt=""
              width={48}
              height={48}
              className="mx-auto mb-3 h-12 w-12 rounded-[var(--radius-xs)] object-cover"
            />
          ) : null}
          <p className="type-caption text-[var(--ink-muted-48)]">{data.workspace.name}</p>
          <h1 className="type-hero-display text-[var(--ink)]">{data.link.title}</h1>
          {data.product.description ? (
            <p className="mt-2 type-body text-[var(--ink-muted-80)]">{data.product.description}</p>
          ) : null}
          <p className="mt-4 type-display-lg text-[var(--primary)]">{brl(data.product.priceCents)}</p>
        </header>

        {done ? (
          <div className="space-y-3 text-center">
            <p className="type-body-strong text-[var(--ink)]">Pedido registrado!</p>
            {instructions ? (
              <p className="type-caption text-[var(--ink-muted-80)]">{instructions}</p>
            ) : (
              <p className="type-caption text-[var(--ink-muted-80)]">Obrigado pela compra.</p>
            )}
          </div>
        ) : pixQr || pixB64 ? (
          <div className="space-y-4">
            <p className="type-body text-[var(--ink-muted-80)]">Pague com PIX para concluir.</p>
            {pixB64 ? (
              <img
                src={`data:image/png;base64,${pixB64}`}
                alt="QR PIX"
                className="mx-auto max-w-[220px] rounded-[var(--radius-xs)] border border-[var(--hairline)]"
              />
            ) : null}
            {pixQr ? (
              <p className="break-all type-caption text-[var(--ink)]">{pixQr}</p>
            ) : null}
          </div>
        ) : (
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              pay();
            }}
          >
            {error ? <p className="type-caption text-[var(--ink-muted-80)]">{error}</p> : null}
            {(["customerName", "customerEmail", "customerPhone"] as const).map((key) => (
              <label key={key} className="block">
                <span className="type-caption text-[var(--ink-muted-48)]">
                  {key === "customerName" ? "Nome" : key === "customerEmail" ? "E-mail" : "WhatsApp"}
                </span>
                <input
                  required
                  className="mt-1 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2.5 type-body"
                  value={form[key]}
                  onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.value }))}
                  type={key === "customerEmail" ? "email" : "text"}
                />
              </label>
            ))}
            <Button type="submit" variant="store-hero" className="w-full" disabled={submitting}>
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : data.product.priceCents > 0 && data.onlinePayment ? (
                `Pagar ${brl(data.product.priceCents)}`
              ) : (
                "Confirmar"
              )}
            </Button>
          </form>
        )}
      </div>
    </BrandThemeScope>
  );
}
