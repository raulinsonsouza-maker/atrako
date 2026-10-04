"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import {
  ConfigPage,
  ConfigSection,
  SaveButton,
  StatusBadge,
  useSaveConfig,
  useWorkspaceConfig,
} from "../_components";

type SecretKey = "capiToken" | "ga4ApiSecret";

export default function ConfigRastreamentoPage() {
  const { data: config, isLoading } = useWorkspaceConfig();
  const { save, saving, saved, error, markDirty } = useSaveConfig();

  const tracking = config?.settings?.tracking ?? {};
  const [pixelId, setPixelId] = useState("");
  const [ga4MeasurementId, setGa4MeasurementId] = useState("");
  const [secrets, setSecrets] = useState<Record<SecretKey, string>>({
    capiToken: "",
    ga4ApiSecret: "",
  });

  useEffect(() => {
    if (!config) return;
    const t = config.settings.tracking ?? {};
    setPixelId(typeof t.pixelId === "string" ? t.pixelId : "");
    setGa4MeasurementId(typeof t.ga4MeasurementId === "string" ? t.ga4MeasurementId : "");
    setSecrets({ capiToken: "", ga4ApiSecret: "" });
  }, [config]);

  function setSecret(key: SecretKey, value: string) {
    setSecrets((s) => ({ ...s, [key]: value }));
    markDirty();
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    await save({
      tracking: {
        pixelId: pixelId.trim(),
        ga4MeasurementId: ga4MeasurementId.trim(),
        capiToken: secrets.capiToken.trim(),
        ga4ApiSecret: secrets.ga4ApiSecret.trim(),
      },
    });
  }

  async function clearSecret(key: SecretKey) {
    await save({ tracking: { [key]: null } });
  }

  function secretHint(has: boolean | undefined, key: SecretKey) {
    if (!has) return undefined;
    return (
      <span className="inline-flex flex-wrap items-center gap-x-2">
        Já configurado. Deixe em branco para manter.
        <Button
          type="button"
          variant="ghost"
          className="!px-0 !py-0 type-fine-print !text-[var(--danger)]"
          onClick={() => void clearSecret(key)}
        >
          Remover
        </Button>
      </span>
    );
  }

  const metaActive = Boolean(tracking.pixelId);
  const ga4Active = Boolean(tracking.ga4MeasurementId);

  return (
    <ConfigPage
      title="Rastreamento"
      loading={isLoading}
      actions={
        <SaveButton form="rastreamento-form" saving={saving} saved={saved} disabled={isLoading} />
      }
    >
      <form id="rastreamento-form" onSubmit={onSubmit} className="flex flex-col gap-6">
        <ConfigSection
          title="Meta"
          description="Pixel nas páginas e conversões enviadas pelo servidor para otimizar os anúncios."
          aside={
            <StatusBadge active={metaActive}>{metaActive ? "Ativo" : "Não configurado"}</StatusBadge>
          }
        >
          <TextField
            label="ID do Pixel"
            value={pixelId}
            onChange={(e) => {
              setPixelId(e.target.value);
              markDirty();
            }}
            placeholder="123456789012345"
            inputMode="numeric"
          />
          <TextField
            label="Token da API de Conversões"
            type="password"
            autoComplete="off"
            value={secrets.capiToken}
            onChange={(e) => setSecret("capiToken", e.target.value)}
            placeholder={tracking.hasCapiToken ? "••••••••" : "Cole o token gerado no Gerenciador de Eventos"}
            hint={secretHint(tracking.hasCapiToken, "capiToken")}
          />
        </ConfigSection>

        <ConfigSection
          title="Google Analytics 4"
          description="Envia visitas e compras para a sua propriedade do GA4."
          aside={
            <StatusBadge active={ga4Active}>{ga4Active ? "Ativo" : "Não configurado"}</StatusBadge>
          }
        >
          <TextField
            label="ID de métricas"
            value={ga4MeasurementId}
            onChange={(e) => {
              setGa4MeasurementId(e.target.value);
              markDirty();
            }}
            placeholder="G-XXXXXXXXXX"
          />
          <TextField
            label="Chave secreta do Measurement Protocol"
            type="password"
            autoComplete="off"
            value={secrets.ga4ApiSecret}
            onChange={(e) => setSecret("ga4ApiSecret", e.target.value)}
            placeholder={tracking.hasGa4ApiSecret ? "••••••••" : "Admin → Fluxos de dados → Chaves secretas"}
            hint={secretHint(tracking.hasGa4ApiSecret, "ga4ApiSecret")}
          />
        </ConfigSection>

        {error ? <p className="type-caption text-[var(--danger)]">{error}</p> : null}
      </form>
    </ConfigPage>
  );
}
