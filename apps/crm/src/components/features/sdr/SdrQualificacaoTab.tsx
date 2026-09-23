"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig, PerguntaAtivaKey } from "@/lib/sdr/types";
import { PERGUNTAS_ATIVAS_KEYS } from "@/lib/sdr/types";

const PERGUNTA_LABELS: Record<PerguntaAtivaKey, string> = {
  contexto: "Contexto (o que levou a entrar em contato)",
  problema: "Problema (onde impacta)",
  perfil: "Perfil (decisor ou não)",
  orcamento: "Orçamento",
  urgencia: "Urgência",
};

export function SdrQualificacaoTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const q = initialConfig.qualificacao;
  const [perguntasAtivas, setPerguntasAtivas] = useState<PerguntaAtivaKey[]>(
    q?.perguntas_ativas ?? ["contexto", "problema", "perfil", "orcamento", "urgencia"]
  );
  const [decisor, setDecisor] = useState(q?.score?.decisor ?? 25);
  const [impactoAlto, setImpactoAlto] = useState(q?.score?.impacto_alto ?? 20);
  const [orcamentoDefinido, setOrcamentoDefinido] = useState(q?.score?.orcamento_definido ?? 30);
  const [urgenciaImediata, setUrgenciaImediata] = useState(q?.score?.urgencia_imediata ?? 15);
  const [foraIcp, setForaIcp] = useState(q?.score?.fora_icp ?? -100);
  const [limiarQualificado, setLimiarQualificado] = useState(q?.limiar_qualificado ?? 70);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (q) {
      setPerguntasAtivas(q.perguntas_ativas);
      setDecisor(q.score.decisor);
      setImpactoAlto(q.score.impacto_alto);
      setOrcamentoDefinido(q.score.orcamento_definido);
      setUrgenciaImediata(q.score.urgencia_imediata);
      setForaIcp(q.score.fora_icp);
      setLimiarQualificado(q.limiar_qualificado);
    }
  }, [q]);

  function togglePergunta(key: PerguntaAtivaKey) {
    setPerguntasAtivas((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, {
        qualificacao: {
          perguntas_ativas: perguntasAtivas,
          score: {
            decisor,
            impacto_alto: impactoAlto,
            orcamento_definido: orcamentoDefinido,
            urgencia_imediata: urgenciaImediata,
            fora_icp: foraIcp,
          },
          limiar_qualificado: limiarQualificado,
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
        <CardTitle>Qualificação</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Quais perguntas usar e pesos do score (customizável sem quebrar a lógica).
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-6">
          <div>
            <span className="block text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Perguntas ativas
            </span>
            <div className="space-y-2">
              {PERGUNTAS_ATIVAS_KEYS.map((key) => (
                <label key={key} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={perguntasAtivas.includes(key)}
                    onChange={() => togglePergunta(key)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {PERGUNTA_LABELS[key]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <span className="block text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Pesos do score (positivos 0–100; fora_icp negativo)
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                type="number"
                min={0}
                max={100}
                label="Decisor"
                value={String(decisor)}
                onChange={(e) => setDecisor(Number(e.target.value) || 0)}
              />
              <Input
                type="number"
                min={0}
                max={100}
                label="Impacto alto"
                value={String(impactoAlto)}
                onChange={(e) => setImpactoAlto(Number(e.target.value) || 0)}
              />
              <Input
                type="number"
                min={0}
                max={100}
                label="Orçamento definido"
                value={String(orcamentoDefinido)}
                onChange={(e) => setOrcamentoDefinido(Number(e.target.value) || 0)}
              />
              <Input
                type="number"
                min={0}
                max={100}
                label="Urgência imediata"
                value={String(urgenciaImediata)}
                onChange={(e) => setUrgenciaImediata(Number(e.target.value) || 0)}
              />
              <Input
                type="number"
                max={-1}
                label="Fora ICP (penalidade)"
                value={String(foraIcp)}
                onChange={(e) => setForaIcp(Number(e.target.value) || -100)}
              />
            </div>
          </div>
          <Input
            type="number"
            min={0}
            max={100}
            label="Limiar para qualificado (0–100)"
            value={String(limiarQualificado)}
            onChange={(e) => setLimiarQualificado(Number(e.target.value) || 70)}
          />
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
