"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig } from "@/lib/sdr/types";

export function SdrRegrasTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const r = initialConfig.regras;
  const [maxPerguntas, setMaxPerguntas] = useState(r?.max_perguntas_seguidas ?? 2);
  const [tentarClarificar, setTentarClarificar] = useState(r?.tentar_clarificar_resposta_vaga ?? true);
  const [tempoMax, setTempoMax] = useState(r?.tempo_max_conversa_min ?? 15);
  const [qtdMaxMsg, setQtdMaxMsg] = useState(r?.quantidade_max_mensagens ?? 50);
  const [delaySimplesMin, setDelaySimplesMin] = useState(r?.delay_pergunta_simples_ms?.min ?? 1500);
  const [delaySimplesMax, setDelaySimplesMax] = useState(r?.delay_pergunta_simples_ms?.max ?? 2500);
  const [delayImportanteMin, setDelayImportanteMin] = useState(r?.delay_pergunta_importante_ms?.min ?? 3000);
  const [delayImportanteMax, setDelayImportanteMax] = useState(r?.delay_pergunta_importante_ms?.max ?? 5000);
  const [delayHandoffMin, setDelayHandoffMin] = useState(r?.delay_antes_handoff_ms?.min ?? 4000);
  const [delayHandoffMax, setDelayHandoffMax] = useState(r?.delay_antes_handoff_ms?.max ?? 6000);
  const [delayEntreMsg, setDelayEntreMsg] = useState(r?.delay_entre_mensagens_quebradas_ms ?? 800);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (r) {
      setMaxPerguntas(r.max_perguntas_seguidas);
      setTentarClarificar(r.tentar_clarificar_resposta_vaga);
      setTempoMax(r.tempo_max_conversa_min);
      setQtdMaxMsg(r.quantidade_max_mensagens);
      setDelaySimplesMin(r.delay_pergunta_simples_ms?.min ?? 1500);
      setDelaySimplesMax(r.delay_pergunta_simples_ms?.max ?? 2500);
      setDelayImportanteMin(r.delay_pergunta_importante_ms?.min ?? 3000);
      setDelayImportanteMax(r.delay_pergunta_importante_ms?.max ?? 5000);
      setDelayHandoffMin(r.delay_antes_handoff_ms?.min ?? 4000);
      setDelayHandoffMax(r.delay_antes_handoff_ms?.max ?? 6000);
      setDelayEntreMsg(r.delay_entre_mensagens_quebradas_ms ?? 800);
    }
  }, [r]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, {
        regras: {
          max_perguntas_seguidas: maxPerguntas,
          tentar_clarificar_resposta_vaga: tentarClarificar,
          tempo_max_conversa_min: tempoMax,
          quantidade_max_mensagens: qtdMaxMsg,
          delay_pergunta_simples_ms: { min: delaySimplesMin, max: delaySimplesMax },
          delay_pergunta_importante_ms: { min: delayImportanteMin, max: delayImportanteMax },
          delay_antes_handoff_ms: { min: delayHandoffMin, max: delayHandoffMax },
          delay_entre_mensagens_quebradas_ms: delayEntreMsg,
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
        <CardTitle>Regras de atendimento</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Como o SDR se comporta (quantidade de perguntas, tempo máximo, etc.).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="number"
            min={1}
            max={5}
            label="Máximo de perguntas seguidas"
            value={String(maxPerguntas)}
            onChange={(e) => setMaxPerguntas(Number(e.target.value) || 1)}
          />
          <label className="flex items-center gap-2">
            <input
              type="checkbox"
              checked={tentarClarificar}
              onChange={(e) => setTentarClarificar(e.target.checked)}
              className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
            />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              Tentar clarificar quando a resposta for vaga
            </span>
          </label>
          <Input
            type="number"
            min={5}
            max={120}
            label="Tempo máximo de conversa (minutos)"
            value={String(tempoMax)}
            onChange={(e) => setTempoMax(Number(e.target.value) || 15)}
          />
          <Input
            type="number"
            min={10}
            max={200}
            label="Quantidade máxima de mensagens"
            value={String(qtdMaxMsg)}
            onChange={(e) => setQtdMaxMsg(Number(e.target.value) || 50)}
          />
          <div className="border-t border-neutral-200 pt-4 dark:border-neutral-700">
            <p className="text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Tempo de resposta (ms) – delay antes de enviar, para parecer mais humano
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                min={500}
                max={15000}
                label="Pergunta simples (min ms)"
                value={String(delaySimplesMin)}
                onChange={(e) => setDelaySimplesMin(Number(e.target.value) || 1500)}
              />
              <Input
                type="number"
                min={500}
                max={15000}
                label="Pergunta simples (max ms)"
                value={String(delaySimplesMax)}
                onChange={(e) => setDelaySimplesMax(Number(e.target.value) || 2500)}
              />
              <Input
                type="number"
                min={500}
                max={15000}
                label="Pergunta importante (min ms)"
                value={String(delayImportanteMin)}
                onChange={(e) => setDelayImportanteMin(Number(e.target.value) || 3000)}
              />
              <Input
                type="number"
                min={500}
                max={15000}
                label="Pergunta importante (max ms)"
                value={String(delayImportanteMax)}
                onChange={(e) => setDelayImportanteMax(Number(e.target.value) || 5000)}
              />
              <Input
                type="number"
                min={500}
                max={15000}
                label="Antes de handoff (min ms)"
                value={String(delayHandoffMin)}
                onChange={(e) => setDelayHandoffMin(Number(e.target.value) || 4000)}
              />
              <Input
                type="number"
                min={500}
                max={15000}
                label="Antes de handoff (max ms)"
                value={String(delayHandoffMax)}
                onChange={(e) => setDelayHandoffMax(Number(e.target.value) || 6000)}
              />
              <Input
                type="number"
                min={300}
                max={3000}
                label="Entre mensagens quebradas (ms)"
                value={String(delayEntreMsg)}
                onChange={(e) => setDelayEntreMsg(Number(e.target.value) || 800)}
              />
            </div>
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
