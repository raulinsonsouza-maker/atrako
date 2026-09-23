"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Textarea } from "@/components/ui/Textarea";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Panel } from "@/components/ui/Panel";

type ProductOption = { id: string; name: string };

export function CreateOfferForm({ products }: { products: ProductOption[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const res = await fetch("/api/admin/offers", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        triggerProductId: String(form.get("triggerProductId") ?? ""),
        offeredProductId: String(form.get("offeredProductId") ?? ""),
        type: String(form.get("type") ?? "ORDER_BUMP"),
        discountPercent: Number(form.get("discountPercent") ?? 0),
        headline: String(form.get("headline") ?? "") || null,
        description: String(form.get("description") ?? "") || null,
        active: form.get("active") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao criar oferta.");
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <Panel className="stack">
      <h2 className="m-0 text-[var(--text-lg)]">Nova oferta</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={onSubmit} className="stack">
        <Field label="Produto gatilho" htmlFor="triggerProductId">
          <Select id="triggerProductId" name="triggerProductId" required defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <Field label="Produto oferecido" htmlFor="offeredProductId">
          <Select id="offeredProductId" name="offeredProductId" required defaultValue="">
            <option value="" disabled>
              Selecione…
            </option>
            {products.map((p) => (
              <option key={p.id} value={p.id}>
                {p.name}
              </option>
            ))}
          </Select>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="type">
            <Select id="type" name="type" defaultValue="ORDER_BUMP">
              <option value="ORDER_BUMP">Order bump</option>
              <option value="POST_PURCHASE">Pós-compra</option>
            </Select>
          </Field>
          <Field label="Desconto (%)" htmlFor="discountPercent">
            <Input
              id="discountPercent"
              name="discountPercent"
              type="number"
              min={0}
              max={100}
              defaultValue={0}
              required
            />
          </Field>
        </div>
        <Field label="Headline" htmlFor="headline">
          <Input id="headline" name="headline" />
        </Field>
        <Field label="Descrição" htmlFor="description">
          <Textarea id="description" name="description" rows={3} />
        </Field>
        <Checkbox id="active" name="active" label="Ativa" defaultChecked />
        <Button type="submit" disabled={loading || products.length < 1}>
          {loading ? "Criando…" : "Criar oferta"}
        </Button>
      </form>
    </Panel>
  );
}
