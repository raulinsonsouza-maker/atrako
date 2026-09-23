"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig, DiaSemana } from "@/lib/sdr/types";
import { DIAS_SEMANA } from "@/lib/sdr/types";

const DIA_LABELS: Record<DiaSemana, string> = {
  seg: "Segunda",
  ter: "Terça",
  qua: "Quarta",
  qui: "Quinta",
  sex: "Sexta",
  sab: "Sábado",
  dom: "Domingo",
};

export function SdrHorariosTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const ho = initialConfig.horarios;
  const [inicio, setInicio] = useState(ho?.inicio ?? "08:00");
  const [fim, setFim] = useState(ho?.fim ?? "18:00");
  const [dias, setDias] = useState<DiaSemana[]>(ho?.dias ?? ["seg", "ter", "qua", "qui", "sex"]);
  const [mensagemForaHorario, setMensagemForaHorario] = useState(
    ho?.mensagem_fora_horario ?? "Agora estamos fora do horário, mas amanhã cedo alguém continua com você."
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (ho) {
      setInicio(ho.inicio);
      setFim(ho.fim);
      setDias(ho.dias);
      setMensagemForaHorario(ho.mensagem_fora_horario);
    }
  }, [ho]);

  function toggleDia(dia: DiaSemana) {
    setDias((prev) =>
      prev.includes(dia) ? prev.filter((d) => d !== dia) : [...prev, dia]
    );
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const result = await saveTenantSdrConfig(tenantId, {
        horarios: {
          inicio: inicio.trim(),
          fim: fim.trim(),
          dias: dias.length ? dias : ["seg", "ter", "qua", "qui", "sex"],
          mensagem_fora_horario: mensagemForaHorario.trim(),
          canais_ativos: ho?.canais_ativos ?? ["whatsapp"],
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
        <CardTitle>Horários e canais</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Horário de atendimento e mensagem fora do horário.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="flex gap-4 items-end">
            <Input
              type="time"
              label="Início"
              value={inicio}
              onChange={(e) => setInicio(e.target.value)}
            />
            <Input
              type="time"
              label="Fim"
              value={fim}
              onChange={(e) => setFim(e.target.value)}
            />
          </div>
          <div>
            <span className="block text-footnote font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              Dias da semana
            </span>
            <div className="flex flex-wrap gap-3">
              {DIAS_SEMANA.map((dia) => (
                <label key={dia} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={dias.includes(dia)}
                    onChange={() => toggleDia(dia)}
                    className="h-4 w-4 rounded border-neutral-300 text-primary-600 focus:ring-primary-500"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">
                    {DIA_LABELS[dia]}
                  </span>
                </label>
              ))}
            </div>
          </div>
          <div>
            <label className="mb-1.5 block text-footnote font-medium text-neutral-700 dark:text-neutral-300">
              Mensagem fora do horário
            </label>
            <textarea
              value={mensagemForaHorario}
              onChange={(e) => setMensagemForaHorario(e.target.value)}
              rows={2}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              placeholder="Agora estamos fora do horário..."
            />
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
