"use client";

import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";
import { Field } from "@/components/ui/Field";
import { Input } from "@/components/ui/Input";
import { Checkbox } from "@/components/ui/Checkbox";
import { Button } from "@/components/ui/Button";
import { Alert } from "@/components/ui/Alert";
import { Panel } from "@/components/ui/Panel";

type Settings = {
  cardEnabled: boolean;
  pixEnabled: boolean;
  minInstallments: number;
  maxInstallments: number;
  statementDescriptor: string;
};

export function PaymentSettingsForm({ settings }: { settings: Settings }) {
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
    const res = await fetch("/api/admin/payment-settings", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        cardEnabled: form.get("cardEnabled") === "on",
        pixEnabled: form.get("pixEnabled") === "on",
        minInstallments: Number(form.get("minInstallments") ?? 1),
        maxInstallments: Number(form.get("maxInstallments") ?? 12),
        statementDescriptor: String(form.get("statementDescriptor") ?? ""),
      }),
    });
    const data = await res.json().catch(() => ({}));
    setLoading(false);
    if (!res.ok) {
      setError(data.error ?? "Falha ao salvar.");
      return;
    }
    setOk("Configurações salvas.");
    router.refresh();
  }

  return (
    <Panel className="stack">
      <h2 className="m-0 text-[var(--text-lg)]">Formas de pagamento</h2>
      {error ? <Alert tone="danger">{error}</Alert> : null}
      {ok ? <Alert tone="success">{ok}</Alert> : null}
      <form onSubmit={onSubmit} className="stack">
        <Checkbox
          id="cardEnabled"
          name="cardEnabled"
          label="Cartão habilitado"
          defaultChecked={settings.cardEnabled}
        />
        <Checkbox
          id="pixEnabled"
          name="pixEnabled"
          label="PIX habilitado"
          defaultChecked={settings.pixEnabled}
        />
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Parcelas mínimas" htmlFor="minInstallments">
            <Input
              id="minInstallments"
              name="minInstallments"
              type="number"
              min={1}
              max={24}
              defaultValue={settings.minInstallments}
              required
            />
          </Field>
          <Field label="Parcelas máximas" htmlFor="maxInstallments">
            <Input
              id="maxInstallments"
              name="maxInstallments"
              type="number"
              min={1}
              max={24}
              defaultValue={settings.maxInstallments}
              required
            />
          </Field>
        </div>
        <Field label="Descrição na fatura" htmlFor="statementDescriptor">
          <Input
            id="statementDescriptor"
            name="statementDescriptor"
            maxLength={13}
            defaultValue={settings.statementDescriptor}
            required
          />
        </Field>
        <Button type="submit" disabled={loading}>
          {loading ? "Salvando…" : "Salvar pagamentos"}
        </Button>
      </form>
    </Panel>
  );
}
