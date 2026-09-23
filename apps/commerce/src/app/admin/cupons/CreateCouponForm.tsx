"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Panel } from "@/components/ui/Panel";

export function CreateCouponForm() {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function onSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const form = new FormData(e.currentTarget);
    const type = String(form.get("type") ?? "PERCENT");
    const valueRaw = String(form.get("value") ?? "0").replace(",", ".");
    const value =
      type === "FIXED"
        ? Math.round(parseFloat(valueRaw || "0") * 100)
        : Math.round(parseFloat(valueRaw || "0"));

    const res = await fetch("/api/admin/coupons", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        code: String(form.get("code") ?? "").trim().toUpperCase(),
        type,
        value,
        maxUses: String(form.get("maxUses") ?? "").trim()
          ? Number(form.get("maxUses"))
          : null,
        active: form.get("active") === "on",
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao criar cupom.");
      return;
    }
    e.currentTarget.reset();
    router.refresh();
  }

  return (
    <Panel className="stack">
      <h2 className="m-0 text-[var(--text-lg)]">Novo cupom</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      <form onSubmit={onSubmit} className="stack">
        <Field label="Código" htmlFor="code">
          <Input id="code" name="code" required placeholder="PROMO10" />
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Tipo" htmlFor="type">
            <Select id="type" name="type" defaultValue="PERCENT">
              <option value="PERCENT">Percentual (%)</option>
              <option value="FIXED">Valor fixo (R$)</option>
            </Select>
          </Field>
          <Field label="Valor" htmlFor="value" hint="Percentual ou reais conforme o tipo.">
            <Input id="value" name="value" type="number" step="0.01" min="0" required />
          </Field>
        </div>
        <Field label="Máx. usos" htmlFor="maxUses">
          <Input id="maxUses" name="maxUses" type="number" min="1" />
        </Field>
        <Checkbox id="active" name="active" label="Ativo" defaultChecked />
        <Button type="submit" disabled={loading}>
          {loading ? "Criando…" : "Criar cupom"}
        </Button>
      </form>
    </Panel>
  );
}
