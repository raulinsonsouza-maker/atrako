"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Panel } from "@/components/ui/Panel";
import { PageHeader } from "@/components/ui/PageHeader";

export function PixelConfigForm({
  pixelId,
  hasToken,
}: {
  pixelId: string;
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
    const capiToken = String(form.get("capiToken") ?? "").trim();
    const res = await fetch("/api/admin/pixel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        pixelId: String(form.get("pixelId") ?? "").trim() || null,
        ...(capiToken ? { capiToken } : {}),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar.");
      return;
    }
    setOk("Pixel salvo.");
    router.refresh();
  }

  return (
    <div className="stack-lg">
      <PageHeader
        title="Configurações"
        description="Pixel global (fallback). Prefira configurar um pixel em cada produto para ofertas separadas."
      />
      <Panel className="stack max-w-xl">
        {error ? <Alert tone="danger">{error}</Alert> : null}
        {ok ? <Alert tone="success">{ok}</Alert> : null}
        <form onSubmit={onSubmit} className="stack">
          <Field
            label="Pixel ID global"
            htmlFor="pixelId"
            hint="Usado só quando o produto não tem pixel próprio."
          >
            <Input id="pixelId" name="pixelId" defaultValue={pixelId} placeholder="1234567890" />
          </Field>
          <Field
            label="CAPI Token global"
            htmlFor="capiToken"
            hint={
              hasToken
                ? "Token já configurado. Deixe em branco para manter. Serve de fallback para produtos sem token."
                : "Access token da Conversions API (fallback)."
            }
          >
            <Input id="capiToken" name="capiToken" type="password" autoComplete="off" />
          </Field>
          <Button type="submit" disabled={loading}>
            {loading ? "Salvando…" : "Salvar pixel"}
          </Button>
        </form>
      </Panel>
    </div>
  );
}
