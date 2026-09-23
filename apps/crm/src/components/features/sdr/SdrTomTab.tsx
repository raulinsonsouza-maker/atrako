"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig, SdrTom } from "@/lib/sdr/types";
import { SDR_TOM_VALUES } from "@/lib/sdr/types";

const TOM_LABELS: Record<SdrTom, string> = {
  muito_informal: "Muito informal",
  conversacional: "Conversacional (padrão recomendado)",
  profissional_direto: "Profissional direto",
  consultivo: "Consultivo",
};

export function SdrTomTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const tom = initialConfig.tom?.tom ?? "conversacional";
  const [value, setValue] = useState<SdrTom>(tom);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    setValue(initialConfig.tom?.tom ?? "conversacional");
  }, [initialConfig.tom?.tom]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, { tom: { tom: value } });
      if (result.ok) setMessage({ type: "success", text: "Salvo." });
      else setMessage({ type: "error", text: result.error ?? "Erro ao salvar." });
    } catch (err) {
      setMessage({ type: "error", text: err instanceof Error ? err.message : "Erro ao salvar." });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Tom de voz</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Define a linguagem e o estilo das mensagens (sem texto livre).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="mb-1.5 block text-footnote font-medium text-neutral-700 dark:text-neutral-300">
              Tom
            </label>
            <select
              value={value}
              onChange={(e) => setValue(e.target.value as SdrTom)}
              className="h-8 w-full max-w-md rounded-sm border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {SDR_TOM_VALUES.map((t) => (
                <option key={t} value={t}>
                  {TOM_LABELS[t]}
                </option>
              ))}
            </select>
          </div>
          {message && (
            <p
              className={
                message.type === "success"
                  ? "text-sm text-green-600 dark:text-green-400"
                  : "text-sm text-red-600 dark:text-red-400"
              }
            >
              {message.text}
            </p>
          )}
          {isAdmin && (
            <Button type="submit" disabled={saving}>
              {saving ? "Salvando…" : "Salvar"}
            </Button>
          )}
        </form>
      </CardContent>
    </Card>
  );
}
