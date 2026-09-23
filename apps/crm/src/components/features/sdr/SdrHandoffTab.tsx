"use client";

import { useState, useEffect } from "react";
import { Card, CardHeader, CardTitle, CardContent, Button, Input } from "@/design/components";
import { saveTenantSdrConfig } from "@/server/actions/sdrConfig";
import type { TenantSdrConfig } from "@/lib/sdr/types";

export function SdrHandoffTab({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const h = initialConfig.handoff;
  const [scoreMinimo, setScoreMinimo] = useState(h?.score_minimo_handoff ?? 70);
  const [palavrasCriticas, setPalavrasCriticas] = useState(
    h?.palavras_criticas?.join(", ") ?? "quero falar com alguém, humano, atendente"
  );
  const [destino, setDestino] = useState(h?.destino ?? "time_comercial");
  const [mensagemHandoff, setMensagemHandoff] = useState(
    h?.mensagem_handoff ?? "Vou te colocar em contato com alguém do time agora."
  );
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);

  useEffect(() => {
    if (h) {
      setScoreMinimo(h.score_minimo_handoff);
      setPalavrasCriticas(h.palavras_criticas?.join(", ") ?? "");
      setDestino(h.destino);
      setMensagemHandoff(h.mensagem_handoff);
    }
  }, [h]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setMessage(null);
    setSaving(true);
    try {
      const list = palavrasCriticas
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
      const result = await saveTenantSdrConfig(tenantId, {
        handoff: {
          score_minimo_handoff: scoreMinimo,
          palavras_criticas: list.length ? list : ["quero falar com alguém", "humano"],
          destino: destino.trim(),
          mensagem_handoff: mensagemHandoff.trim(),
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
        <CardTitle>Handoff humano</CardTitle>
        <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">
          Quando e como passar para um atendente humano.
        </p>
      </CardHeader>
      <CardContent>
        <form onSubmit={handleSubmit} className="space-y-4">
          <Input
            type="number"
            min={0}
            max={100}
            label="Score mínimo para handoff"
            value={String(scoreMinimo)}
            onChange={(e) => setScoreMinimo(Number(e.target.value) || 70)}
          />
          <Input
            label="Palavras-chave de transferência imediata (separadas por vírgula)"
            value={palavrasCriticas}
            onChange={(e) => setPalavrasCriticas(e.target.value)}
            placeholder="quero falar com alguém, humano"
          />
          <Input
            label="Destino (grupo ou usuário)"
            value={destino}
            onChange={(e) => setDestino(e.target.value)}
            placeholder="time_comercial"
          />
          <div>
            <label className="mb-1.5 block text-footnote font-medium text-neutral-700 dark:text-neutral-300">
              Mensagem de transição
            </label>
            <textarea
              value={mensagemHandoff}
              onChange={(e) => setMensagemHandoff(e.target.value)}
              rows={3}
              className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm text-neutral-900 focus:border-primary-500 focus:outline-none focus:ring-2 focus:ring-primary-500/20 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
              placeholder="Vou te colocar em contato com alguém do time agora."
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
