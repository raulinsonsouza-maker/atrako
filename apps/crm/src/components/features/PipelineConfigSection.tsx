"use client";

import { useState, useEffect } from "react";
import {
  getPipelineWithStages,
  createLeadStage,
  updateLeadStageConfig,
  deleteLeadStage,
  reorderStages,
} from "@/server/actions/pipeline";
import { Button, Input, Card, CardHeader, CardTitle, CardContent, Modal } from "@/design/components";
import { Plus, X, Edit2, Trash2, ArrowUp, ArrowDown } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  order: number;
  color: string;
  probability: number | null;
  isSystemStage: boolean;
}

export function PipelineConfigSection({ tenantId }: { tenantId: string }) {
  const [stages, setStages] = useState<Stage[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [deleteConfirm, setDeleteConfirm] = useState<string | null>(null);

  const loadStages = async () => {
    setLoading(true);
    try {
      const pipeline = await getPipelineWithStages(tenantId);
      if (pipeline?.stages) {
        setStages(
          pipeline.stages.map((s) => ({
            id: s.id,
            name: s.name,
            order: s.order,
            color: s.color,
            probability: s.probability,
            isSystemStage: s.isSystemStage ?? false,
          }))
        );
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar estágios");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadStages();
  }, [tenantId]);

  const handleMoveUp = async (index: number) => {
    if (index === 0) return;
    const stage = stages[index];
    if (stage.isSystemStage && index === 0) return; // Não mover "Novo"

    const newStages = [...stages];
    [newStages[index - 1], newStages[index]] = [newStages[index], newStages[index - 1]];

    // Validar posições de estágios fixos
    const novoIndex = newStages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("novo"));
    if (novoIndex !== 0) {
      setError("O estágio 'Novo' deve ser o primeiro");
      return;
    }

    setStages(newStages);
    try {
      await reorderStages(tenantId, newStages.map((s) => s.id));
      await loadStages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reordenar estágios");
      await loadStages();
    }
  };

  const handleMoveDown = async (index: number) => {
    if (index === stages.length - 1) return;
    const stage = stages[index];
    const lastIndex = stages.length - 1;
    const secondLastIndex = stages.length - 2;

    // Não permitir mover "Ganho" ou "Perdido" se já estão nas últimas posições
    if (stage.isSystemStage && (index === lastIndex || index === secondLastIndex)) {
      const ganhoIndex = stages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("ganho"));
      const perdidoIndex = stages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("perdido"));
      if (
        (ganhoIndex === secondLastIndex && perdidoIndex === lastIndex) ||
        (perdidoIndex === secondLastIndex && ganhoIndex === lastIndex)
      ) {
        return;
      }
    }

    const newStages = [...stages];
    [newStages[index], newStages[index + 1]] = [newStages[index + 1], newStages[index]];

    // Validar posições de estágios fixos após movimentação
    const novoIndex = newStages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("novo"));
    if (novoIndex !== 0) {
      setError("O estágio 'Novo' deve ser o primeiro");
      return;
    }

    const ganhoIndexNew = newStages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("ganho"));
    const perdidoIndexNew = newStages.findIndex((s) => s.isSystemStage && s.name.toLowerCase().includes("perdido"));
    const lastIndexNew = newStages.length - 1;

    // Verificar se ambos estão nas duas últimas posições (em qualquer ordem)
    const isGanhoLast = ganhoIndexNew === lastIndexNew || ganhoIndexNew === lastIndexNew - 1;
    const isPerdidoLast = perdidoIndexNew === lastIndexNew || perdidoIndexNew === lastIndexNew - 1;

    if (ganhoIndexNew !== -1 && perdidoIndexNew !== -1 && (!isGanhoLast || !isPerdidoLast)) {
      setError("Os estágios 'Ganho' e 'Perdido' devem ser os dois últimos");
      return;
    }

    setStages(newStages);
    try {
      await reorderStages(tenantId, newStages.map((s) => s.id));
      await loadStages();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao reordenar estágios");
      await loadStages();
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando estágios do pipeline…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Configuração do Pipeline</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        {showForm && (
          <StageForm
            tenantId={tenantId}
            onSave={async (data) => {
              setSaving(true);
              setError(null);
              try {
                await createLeadStage(tenantId, data);
                setShowForm(false);
                await loadStages();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao criar estágio");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        <div className="space-y-2">
          {stages.map((stage, index) => (
            <div
              key={stage.id}
              className="flex items-center gap-3 rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
            >
              <div
                className="h-4 w-4 rounded"
                style={{ backgroundColor: stage.color }}
                title={`Cor: ${stage.color}`}
              />
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-neutral-900 dark:text-neutral-100">{stage.name}</span>
                  {stage.isSystemStage && (
                    <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                      Sistema
                    </span>
                  )}
                  <span className="text-sm text-neutral-500">
                    {stage.probability !== null ? `${stage.probability}%` : "—"}
                  </span>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <button
                  onClick={() => handleMoveUp(index)}
                  disabled={index === 0 || (stage.isSystemStage && index === 0)}
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-neutral-700"
                  title="Mover para cima"
                >
                  <ArrowUp className="h-4 w-4" />
                </button>
                <button
                  onClick={() => handleMoveDown(index)}
                  disabled={
                    index === stages.length - 1 ||
                    (stage.isSystemStage &&
                      (index === stages.length - 1 || index === stages.length - 2) &&
                      (stage.name.toLowerCase().includes("ganho") || stage.name.toLowerCase().includes("perdido")))
                  }
                  className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 disabled:opacity-30 disabled:cursor-not-allowed dark:hover:bg-neutral-700"
                  title="Mover para baixo"
                >
                  <ArrowDown className="h-4 w-4" />
                </button>
                {!stage.isSystemStage && (
                  <>
                    <button
                      onClick={() => setEditingId(stage.id)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
                      title="Editar"
                    >
                      <Edit2 className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => setDeleteConfirm(stage.id)}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-error-600 dark:hover:bg-neutral-700"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </>
                )}
                {stage.isSystemStage && (
                  <button
                    onClick={() => setEditingId(stage.id)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
                    title="Editar cor e probabilidade"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                )}
              </div>
            </div>
          ))}
          {!showForm && (
            <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
              <Plus className="mr-2 h-4 w-4" />
              Adicionar estágio
            </Button>
          )}
        </div>

        {editingId && (
          <StageForm
            tenantId={tenantId}
            initialData={stages.find((s) => s.id === editingId)}
            onSave={async (data) => {
              setSaving(true);
              setError(null);
              try {
                await updateLeadStageConfig(editingId, tenantId, data);
                setEditingId(null);
                await loadStages();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao atualizar estágio");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setEditingId(null)}
            saving={saving}
          />
        )}

        {deleteConfirm && (
          <Modal
            open={!!deleteConfirm}
            onClose={() => setDeleteConfirm(null)}
            title="Confirmar exclusão"
            footer={
              <>
                <Button variant="outline" onClick={() => setDeleteConfirm(null)}>
                  Cancelar
                </Button>
                <Button
                  variant="outline"
                  className="text-error-600"
                  onClick={async () => {
                    try {
                      await deleteLeadStage(deleteConfirm, tenantId);
                      setDeleteConfirm(null);
                      await loadStages();
                    } catch (e) {
                      setError(e instanceof Error ? e.message : "Erro ao excluir estágio");
                      setDeleteConfirm(null);
                    }
                  }}
                >
                  Excluir
                </Button>
              </>
            }
          >
            <p className="text-neutral-700 dark:text-neutral-300">
              Tem certeza que deseja excluir este estágio? Os leads e oportunidades associados serão movidos para o
              estágio "Novo".
            </p>
          </Modal>
        )}
      </CardContent>
    </Card>
  );
}

function StageForm({
  tenantId,
  onSave,
  onCancel,
  saving,
  initialData,
}: {
  tenantId: string;
  onSave: (data: { name: string; color: string; probability?: number }) => void;
  onCancel: () => void;
  saving: boolean;
  initialData?: Stage;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [color, setColor] = useState(initialData?.color || "#94a3b8");
  const [probability, setProbability] = useState(initialData?.probability?.toString() || "");

  const isSystemStage = initialData?.isSystemStage ?? false;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      color: color.trim(),
      probability: probability ? parseInt(probability, 10) : undefined,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
      {isSystemStage && (
        <div className="rounded bg-blue-50 p-3 text-sm text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
          Este é um estágio fixo do sistema. Apenas cor e probabilidade podem ser alteradas.
        </div>
      )}
      <Input
        label="Nome do estágio"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        disabled={isSystemStage}
        placeholder="Ex: Qualificação"
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Cor</label>
        <div className="flex items-center gap-2">
          <input
            type="color"
            value={color}
            onChange={(e) => setColor(e.target.value)}
            className="h-10 w-20 cursor-pointer rounded border border-neutral-300 dark:border-neutral-600"
          />
          <Input
            value={color}
            onChange={(e) => setColor(e.target.value)}
            placeholder="#94a3b8"
            className="flex-1"
          />
        </div>
      </div>

      <Input
        label="Probabilidade (%)"
        type="number"
        min="0"
        max="100"
        value={probability}
        onChange={(e) => setProbability(e.target.value)}
        placeholder="0-100"
      />

      <div className="flex gap-2">
        <Button type="submit" disabled={saving || !name.trim()}>
          {saving ? "Salvando..." : initialData ? "Atualizar" : "Criar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
