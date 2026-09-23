"use client";

import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useConfigWorkspace } from "../_components";
import { BrandColorPicker } from "@/components/ui/brand-color-picker";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";
import { DEFAULT_PRIMARY, normalizePrimaryHex } from "@/lib/brand/primaryColor";

const TIMEZONES = [
  "America/Sao_Paulo",
  "America/Manaus",
  "America/Belem",
  "America/Fortaleza",
  "America/Recife",
  "America/Bahia",
  "America/Cuiaba",
  "America/Porto_Velho",
  "America/Rio_Branco",
  "America/Noronha",
];

const CURRENCIES = [
  { value: "BRL", label: "BRL" },
  { value: "USD", label: "USD" },
  { value: "EUR", label: "EUR" },
];

const fieldClass =
  "mt-2 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

export default function ConfigEmpresaPage() {
  const qc = useQueryClient();
  const { workspaceId } = useConfigWorkspace();
  const { data: config, isLoading } = useQuery({
    queryKey: ["workspace-config", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/config?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json();
    },
    enabled: Boolean(workspaceId),
  });

  const [nome, setNome] = useState("");
  const [timezone, setTimezone] = useState("America/Sao_Paulo");
  const [currency, setCurrency] = useState("BRL");
  const [primaryColor, setPrimaryColor] = useState(DEFAULT_PRIMARY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!config) return;
    setNome(config.workspace?.name ?? "");
    setTimezone(config.settings?.timezone ?? "America/Sao_Paulo");
    setCurrency(config.settings?.currency ?? "BRL");
    setPrimaryColor(normalizePrimaryHex(config.settings?.primaryColor) ?? DEFAULT_PRIMARY);
  }, [config]);

  async function save(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    setSaved(false);
    try {
      const hex = normalizePrimaryHex(primaryColor);
      if (!hex) {
        setError("Cor inválida.");
        setSaving(false);
        return;
      }
      const r = await fetch("/api/atrako/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, nome, timezone, currency, primaryColor: hex }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Não foi possível salvar.");
      }
      await qc.invalidateQueries({ queryKey: ["workspace-config", workspaceId] });
      await qc.invalidateQueries({ queryKey: ["brand-clientes"] });
      setSaved(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Não foi possível salvar.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="min-h-full bg-[var(--canvas-parchment)]">
      <div className="frosted-bar sticky top-0 z-20 border-b border-[rgba(0,0,0,0.08)]">
        <div className="mx-auto flex h-[52px] max-w-content items-center justify-between gap-4 px-4 md:px-8">
          <div className="flex min-w-0 items-center gap-3">
            <BackLink href="/config" />
              <p className="type-body-strong truncate text-[var(--ink)]">Empresa</p>
          </div>
          <Button
            type="submit"
            form="empresa-form"
            variant="primary"
            disabled={saving || isLoading}
            className="!px-5 !py-2 type-button-utility"
          >
            {saving ? "…" : saved ? (
              <span className="inline-flex items-center gap-1">
                <Check className="h-3.5 w-3.5" strokeWidth={2.5} /> Salvo
              </span>
            ) : (
              "Salvar"
            )}
          </Button>
        </div>
      </div>

      <div className="mx-auto max-w-prose px-4 py-8 md:px-8 md:py-10">
        {isLoading ? (
          <div className="flex justify-center py-16">
            <Loader2 className="h-6 w-6 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <form id="empresa-form" onSubmit={save} className="space-y-5">
            <div className="utility-card space-y-5">
              <label className="block">
                <span className="type-caption-strong text-[var(--ink)]">Nome</span>
                <input
                  className={fieldClass}
                  value={nome}
                  onChange={(e) => setNome(e.target.value)}
                  placeholder="Nome da empresa"
                  required
                />
              </label>

              <div>
                <p className="mb-3 type-caption-strong text-[var(--ink)]">Cor</p>
                <BrandColorPicker
                  value={primaryColor}
                  onChange={(v) => {
                    setPrimaryColor(v);
                    setSaved(false);
                  }}
                  brandName={nome || "Sua marca"}
                />
              </div>
            </div>

            <div className="utility-card">
              <div className="grid gap-5 sm:grid-cols-2">
                <label className="block">
                  <span className="type-caption-strong text-[var(--ink)]">Fuso</span>
                  <PillSelect
                    className="mt-2 w-full"
                    size="field"
                    value={timezone}
                    onChange={setTimezone}
                    options={[
                      ...(!TIMEZONES.includes(timezone)
                        ? [{ value: timezone, label: timezone }]
                        : []),
                      ...TIMEZONES.map((tz) => ({
                        value: tz,
                        label: tz.replace("America/", "").replace(/_/g, " "),
                      })),
                    ]}
                    aria-label="Fuso"
                  />
                </label>
                <label className="block">
                  <span className="type-caption-strong text-[var(--ink)]">Moeda</span>
                  <PillSelect
                    className="mt-2 w-full"
                    size="field"
                    value={currency}
                    onChange={setCurrency}
                    options={[
                      ...CURRENCIES,
                      ...(!CURRENCIES.some((c) => c.value === currency)
                        ? [{ value: currency, label: currency }]
                        : []),
                    ]}
                    aria-label="Moeda"
                  />
                </label>
              </div>
            </div>

            {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
          </form>
        )}
      </div>
    </div>
  );
}
