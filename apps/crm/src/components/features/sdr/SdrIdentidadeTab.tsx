"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig, SdrIdioma } from "@/lib/sdr/types";
import { SDR_IDIOMAS } from "@/lib/sdr/types";

const IDIOMA_LABELS: Record<SdrIdioma, string> = {
  "pt-BR": "Português (Brasil)",
  es: "Espanhol",
  en: "Inglês",
};

export function SdrIdentidadeTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const id = initialConfig.identidade;
  const [nomeSdr, setNomeSdr] = useState(id?.nome_sdr ?? "Atendente");
  const [apresentacao, setApresentacao] = useState(id?.apresentacao ?? "Sou do time comercial.");
  const [empresaMarca, setEmpresaMarca] = useState(id?.empresa_marca ?? "");
  const [idioma, setIdioma] = useState<SdrIdioma>(id?.idioma ?? "pt-BR");
  const [usarEmojis, setUsarEmojis] = useState(id?.usar_emojis ?? false);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (id) {
      setNomeSdr(id.nome_sdr);
      setApresentacao(id.apresentacao);
      setEmpresaMarca(id.empresa_marca);
      setIdioma(id.idioma);
      setUsarEmojis(id.usar_emojis);
    }
  }, [id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, {
        identidade: {
          nome_sdr: nomeSdr.trim(),
          apresentacao: apresentacao.trim(),
          empresa_marca: empresaMarca.trim(),
          idioma,
          usar_emojis: usarEmojis,
        },
      });
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
        <CardTitle>Identidade do SDR</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Como o SDR se apresenta ao lead (nome, apresentação, empresa, idioma).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            label="Nome do atendente"
            value={nomeSdr}
            onChange={(e) => setNomeSdr(e.target.value)}
            placeholder="Ex: Lucas"
          />
          <Input
            label="Apresentação curta"
            value={apresentacao}
            onChange={(e) => setApresentacao(e.target.value)}
            placeholder="Ex: Sou do time comercial da ProspectAds"
          />
          <Input
            label="Empresa / marca"
            value={empresaMarca}
            onChange={(e) => setEmpresaMarca(e.target.value)}
            placeholder="Ex: ProspectAds"
          />
          <div>
            <label className="mb-1.5 block text-footnote font-medium text-neutral-700 dark:text-neutral-300">
              Idioma
            </label>
            <select
              value={idioma}
              onChange={(e) => setIdioma(e.target.value as SdrIdioma)}
              className="h-8 w-full rounded-sm border border-neutral-300 bg-white px-3 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            >
              {SDR_IDIOMAS.map((id) => (
                <option key={id} value={id}>
                  {IDIOMA_LABELS[id]}
                </option>
              ))}
            </select>
          </div>
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={usarEmojis}
              onChange={(e) => setUsarEmojis(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">Usar emojis</span>
          </label>
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
