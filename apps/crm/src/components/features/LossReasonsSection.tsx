"use client";

import { useState, useEffect } from "react";
import {
  listLossReasons,
  createLossReason,
  updateLossReason,
  deleteLossReason,
  initializeDefaultLossReasons,
} from "@/server/actions/lossReason";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Plus, X, Edit2, Trash2 } from "lucide-react";

interface LossReason {
  id: string;
  name: string;
  isDefault: boolean;
  order: number;
  createdAt: Date;
  updatedAt: Date;
}

export function LossReasonsSection({ tenantId }: { tenantId: string }) {
  const [reasons, setReasons] = useState<LossReason[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [initializing, setInitializing] = useState(false);

  const loadReasons = async () => {
    setLoading(true);
    try {
      const r = await listLossReasons(tenantId);
      setReasons(r);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar motivos de perda");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReasons();
  }, [tenantId]);

  const handleInitializeDefaults = async () => {
    setInitializing(true);
    setError(null);
    try {
      await initializeDefaultLossReasons(tenantId);
      await loadReasons();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao inicializar motivos padrão");
    } finally {
      setInitializing(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando motivos de perda…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Motivos de Perda</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        {reasons.length === 0 && (
          <div className="mb-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
            <p className="mb-2 text-sm text-neutral-600 dark:text-neutral-400">
              Nenhum motivo de perda cadastrado. Deseja inicializar com os motivos padrão de CRM?
            </p>
            <Button onClick={handleInitializeDefaults} disabled={initializing} variant="outline" size="sm">
              {initializing ? "Inicializando..." : "Inicializar Motivos Padrão"}
            </Button>
          </div>
        )}

        {showForm && (
          <LossReasonForm
            tenantId={tenantId}
            onSave={async (data) => {
              setSaving(true);
              try {
                await createLossReason(tenantId, {
                  name: data.name,
                  order: data.order ?? 0,
                  isDefault: data.isDefault ?? false,
                });
                setShowForm(false);
                await loadReasons();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao criar motivo de perda");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {reasons.length > 0 && (
          <div className="space-y-2">
            {reasons.map((reason) => (
              <div
                key={reason.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{reason.name}</span>
                    {reason.isDefault && (
                      <span className="rounded bg-blue-100 px-2 py-0.5 text-xs text-blue-700 dark:bg-blue-900/30 dark:text-blue-300">
                        Padrão
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(reason.id)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
                    title="Editar"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  {!reason.isDefault && (
                    <button
                      onClick={async () => {
                        if (confirm(`Tem certeza que deseja excluir "${reason.name}"?`)) {
                          try {
                            await deleteLossReason(reason.id, tenantId);
                            await loadReasons();
                          } catch (e) {
                            setError(e instanceof Error ? e.message : "Erro ao excluir motivo de perda");
                          }
                        }
                      }}
                      className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-error-600 dark:hover:bg-neutral-700"
                      title="Excluir"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
            {!showForm && (
              <Button onClick={() => setShowForm(true)} variant="outline" className="mt-4">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar motivo de perda
              </Button>
            )}
          </div>
        )}

        {editingId && (
          <LossReasonForm
            tenantId={tenantId}
            initialData={reasons.find((r) => r.id === editingId)}
            onSave={async (data) => {
              setSaving(true);
              try {
                await updateLossReason(editingId, tenantId, data);
                setEditingId(null);
                await loadReasons();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao atualizar motivo de perda");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setEditingId(null)}
            saving={saving}
          />
        )}
      </CardContent>
    </Card>
  );
}

function LossReasonForm({
  tenantId,
  onSave,
  onCancel,
  saving,
  initialData,
}: {
  tenantId: string;
  onSave: (data: { name: string; order?: number; isDefault?: boolean }) => void;
  onCancel: () => void;
  saving: boolean;
  initialData?: LossReason;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [order, setOrder] = useState(initialData?.order?.toString() || "0");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSave({
      name: name.trim(),
      order: parseInt(order, 10) || 0,
      isDefault: initialData?.isDefault ?? false,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
      <Input
        label="Nome do motivo"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Ex: Preço muito alto"
      />

      <Input
        label="Ordem"
        type="number"
        value={order}
        onChange={(e) => setOrder(e.target.value)}
        placeholder="0"
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
