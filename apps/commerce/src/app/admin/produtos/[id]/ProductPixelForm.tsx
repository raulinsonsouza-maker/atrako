"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";

export function ProductPixelForm({
  productId,
  metaPixelId,
  hasToken,
}: {
  productId: string;
  metaPixelId: string;
  hasToken: boolean;
}) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [ok, setOk] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setOk(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const pixel = String(form.get("metaPixelId") ?? "").trim();
    const token = String(form.get("metaCapiToken") ?? "").trim();
    const clearToken = form.get("clearToken") === "on";

    const body: Record<string, string | null> = {
      metaPixelId: pixel || null,
    };
    if (token) body.metaCapiToken = token;
    if (clearToken) body.metaCapiToken = null;

    const res = await fetch(`/api/admin/products/${productId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar.");
      return;
    }
    setOk("Pixel deste produto salvo.");
    router.refresh();
  }

  return (
    <form onSubmit={onSubmit} className="admin-pixel-card stack">
      <div className="stack-sm">
        <h2 className="m-0 text-[var(--text-base)] font-semibold tracking-[-0.02em]">
          Meta Pixel
        </h2>
        <p className="m-0 text-[var(--text-sm)] text-[var(--muted)]">
          Cada oferta deve ter o próprio pixel para o aprendizado do anúncio não misturar com
          outras.
        </p>
      </div>

      {error ? <Alert tone="danger">{error}</Alert> : null}
      {ok ? <Alert tone="success">{ok}</Alert> : null}

      <Field label="Pixel ID deste produto" htmlFor="metaPixelId">
        <Input
          id="metaPixelId"
          name="metaPixelId"
          defaultValue={metaPixelId}
          placeholder="Ex: 123456789012345"
          autoComplete="off"
        />
      </Field>

      <Field
        label="CAPI Token (opcional)"
        htmlFor="metaCapiToken"
        hint={
          hasToken
            ? "Token já salvo neste produto. Deixe em branco para manter. Sem token próprio, usa o da Config."
            : "Se vazio, usa o token global em Config. Ideal: um token por pixel."
        }
      >
        <Input
          id="metaCapiToken"
          name="metaCapiToken"
          type="password"
          autoComplete="off"
          placeholder={hasToken ? "••••••••" : "Access token"}
        />
      </Field>

      {hasToken ? (
        <label className="cluster gap-2 text-[var(--text-sm)] text-[var(--muted)] cursor-pointer">
          <input type="checkbox" name="clearToken" />
          Remover token deste produto
        </label>
      ) : null}

      <Button type="submit" disabled={loading} size="sm">
        {loading ? "Salvando…" : "Salvar pixel"}
      </Button>
    </form>
  );
}
