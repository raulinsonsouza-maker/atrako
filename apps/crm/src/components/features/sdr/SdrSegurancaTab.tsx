"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig, ForcarHandoffKey } from "@/lib/sdr/types";
import { FORCAR_HANDOFF_KEYS } from "@/lib/sdr/types";

const FORCAR_LABELS: Record<ForcarHandoffKey, string> = {
  preco_detalhado: "Preço detalhado",
  contrato: "Contrato",
  juridico: "Jurídico",
  reclamacao: "Reclamação",
};

export function SdrSegurancaTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const s = initialConfig.seguranca;
  const [bloquearForaEscopo, setBloquearForaEscopo] = useState(s?.bloquear_fora_escopo ?? true);
  const [forcarHandoffEm, setForcarHandoffEm] = useState<ForcarHandoffKey[]>(
    s?.forcar_handoff_em ?? ["preco_detalhado", "contrato", "juridico"]
  );
  const [limiteTamanho, setLimiteTamanho] = useState(
    s?.limite_tamanho_resposta != null ? String(s.limite_tamanho_resposta) : ""
  );
  const [logDecisoes, setLogDecisoes] = useState(s?.log_decisoes ?? true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (s) {
      setBloquearForaEscopo(s.bloquear_fora_escopo);
      setForcarHandoffEm(s.forcar_handoff_em);
      setLimiteTamanho(
        s.limite_tamanho_resposta != null ? String(s.limite_tamanho_resposta) : ""
      );
      setLogDecisoes(s.log_decisoes);
    }
  }, [s]);

  function toggleForcar(key: ForcarHandoffKey) {
    setForcarHandoffEm((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, {
        seguranca: {
          bloquear_fora_escopo: bloquearForaEscopo,
          forcar_handoff_em: forcarHandoffEm,
          limite_tamanho_resposta: limiteTamanho ? Number(limiteTamanho) || undefined : undefined,
          log_decisoes: logDecisoes,
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
        <CardTitle>Segurança e limites</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Proteções obrigatórias: bloquear fora do escopo, forçar handoff em temas sensíveis.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={bloquearForaEscopo}
              onChange={(e) => setBloquearForaEscopo(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Bloquear respostas fora do escopo
            </span>
          </label>
          <div>
            <span className="block text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Forçar handoff em
            </span>
            <div className="space-y-2">
              {FORCAR_HANDOFF_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={forcarHandoffEm.includes(key)}
                    onChange={() => toggleForcar(key)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {FORCAR_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <Input
            type="number"
            min={100}
            max={2000}
            label="Limite de tamanho de resposta (caracteres, opcional)"
            value={limiteTamanho}
            onChange={(e) => setLimiteTamanho(e.target.value)}
            placeholder="Ex: 500"
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={logDecisoes}
              onChange={(e) => setLogDecisoes(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Log completo de decisões
            </span>
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
