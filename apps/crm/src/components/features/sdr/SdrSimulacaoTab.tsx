"use client";

import { useState, useCallback } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import type { TenantSdrConfig } from "@/lib/sdr/types";
import type { SdrEstadoFluxo, SdrTom } from "@/lib/sdr/types";
import { SDR_ESTADOS_FLUXO } from "@/lib/sdr/types";
import { getCopyForEstado } from "@/lib/sdr/copies";

const ESTADO_LABELS: Record<SdrEstadoFluxo, string> = {
  inicio: "Início",
  contexto: "Contexto",
  problema: "Problema",
  perfil: "Perfil",
  orcamento: "Orçamento",
  urgencia: "Urgência",
  qualificado: "Qualificado",
  handoff: "Handoff",
};

/** Ordem de avanço no fluxo (state machine simplificada para simulação). */
const PROXIMO_ESTADO: Record<SdrEstadoFluxo, SdrEstadoFluxo | null> = {
  inicio: "contexto",
  contexto: "problema",
  problema: "perfil",
  perfil: "orcamento",
  orcamento: "urgencia",
  urgencia: "qualificado",
  qualificado: "handoff",
  handoff: null,
};

/** Score simulado por estado (para demonstração). */
const SCORE_POR_ESTADO: Record<SdrEstadoFluxo, number> = {
  inicio: 0,
  contexto: 10,
  problema: 25,
  perfil: 40,
  orcamento: 55,
  urgencia: 70,
  qualificado: 85,
  handoff: 85,
};

export function SdrSimulacaoTab({
  initialConfig,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const tom: SdrTom = initialConfig.tom?.tom ?? "conversacional";
  const limiar = initialConfig.qualificacao?.limiar_qualificado ?? 70;
  const scoreMinHandoff = initialConfig.handoff?.score_minimo_handoff ?? 70;

  const [estadoAtual, setEstadoAtual] = useState<SdrEstadoFluxo>("inicio");
  const [mensagemLead, setMensagemLead] = useState("");
  const [historico, setHistorico] = useState<{ role: "lead" | "sdr"; text: string }[]>([]);

  const proximaCopy = getCopyForEstado(tom, estadoAtual);
  const scoreAtual = SCORE_POR_ESTADO[estadoAtual];
  const fariaHandoff = estadoAtual === "handoff" || (estadoAtual === "qualificado" && scoreAtual >= scoreMinHandoff);

  const avancar = useCallback(() => {
    const prox = PROXIMO_ESTADO[estadoAtual];
    if (prox) {
      setEstadoAtual(prox);
      setHistorico((prev) => [
        ...prev,
        { role: "lead", text: mensagemLead || "(simulado)" },
        { role: "sdr", text: getCopyForEstado(tom, prox) },
      ]);
      setMensagemLead("");
    }
  }, [estadoAtual, mensagemLead, tom]);

  function handleEnviar(e: React.FormEvent) {
    e.preventDefault();
    avancar();
  }

  function reiniciar() {
    setEstadoAtual("inicio");
    setMensagemLead("");
    setHistorico([]);
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Teste e simulação</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Simule uma conversa e veja estado, próxima mensagem e momento de handoff (não envia mensagens reais).
        </p>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex flex-wrap gap-4 text-sm">
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Tom: </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">{tom}</span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Estado atual: </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {ESTADO_LABELS[estadoAtual]}
              </span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Score simulado: </span>
              <span className="font-medium text-neutral-900 dark:text-neutral-100">
                {scoreAtual}
              </span>
              <span className="text-neutral-500 dark:text-neutral-400"> (limiar: {limiar})</span>
            </div>
            <div>
              <span className="text-neutral-500 dark:text-neutral-400">Handoff: </span>
              <span
                className={
                  fariaHandoff
                    ? "font-medium text-green-600 dark:text-green-400"
                    : "font-medium text-neutral-600 dark:text-neutral-400"
                }
              >
                {fariaHandoff ? "Sim" : "Não"}
              </span>
            </div>
          </div>

          <div className="rounded-lg border border-neutral-200 bg-neutral-50 p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
            <p className="text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-1">
              Próxima mensagem do SDR (copy)
            </p>
            <p className="text-sm text-neutral-900 dark:text-neutral-100 whitespace-pre-wrap">
              {proximaCopy}
            </p>
          </div>

          <form onSubmit={handleEnviar} className="flex gap-2">
            <Input
              value={mensagemLead}
              onChange={(e) => setMensagemLead(e.target.value)}
              placeholder="Mensagem do lead (simulado)"
              className="flex-1"
            />
            <Button type="submit" disabled={estadoAtual === "handoff"}>
              Enviar (avançar)
            </Button>
          </form>

          <Button type="button" variant="outline" onClick={reiniciar}>
            Reiniciar simulação
          </Button>

          {historico.length > 0 && (
            <div className="rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800/50">
              <p className="text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
                Histórico da simulação
              </p>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {historico.map((item, i) => (
                  <div
                    key={i}
                    className={
                      item.role === "sdr"
                        ? "text-sm text-primary-600 dark:text-primary-400"
                        : "text-sm text-neutral-600 dark:text-neutral-400"
                    }
                  >
                    <span className="font-medium">{item.role === "lead" ? "Lead: " : "SDR: "}</span>
                    <span className="whitespace-pre-wrap">{item.text}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
