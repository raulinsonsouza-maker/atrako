"use client";

import { useState, useEffect } from "react";
import {
  listAutomationRules,
  createAutomationRule,
  updateAutomationRule,
  deleteAutomationRule,
} from "@/server/actions/automation";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Plus, X, Edit2, Trash2, Play, Pause } from "lucide-react";
import { AutomationTrigger } from "@prisma/client";
import { listUsers } from "@/server/actions/lead";
import { getPipelineWithStages } from "@/server/actions/pipeline";

interface AutomationRule {
  id: string;
  name: string;
  enabled: boolean;
  trigger: AutomationTrigger;
  triggerConfig: unknown;
  actions: unknown;
  order: number;
}

const TRIGGER_LABELS: Record<AutomationTrigger, string> = {
  LEAD_CREATED: "Lead criado",
  LEAD_STAGE_CHANGED: "Mudança de estágio",
  LEAD_STATUS_CHANGED: "Mudança de status",
  LEAD_ASSIGNED: "Lead atribuído",
  LEAD_NO_REPLY: "Sem resposta",
  TASK_OVERDUE: "Tarefa atrasada",
  OPPORTUNITY_CREATED: "Oportunidade criada",
  OPPORTUNITY_WON: "Oportunidade ganha",
  OPPORTUNITY_LOST: "Oportunidade perdida",
};

const ACTION_TYPES = [
  { value: "CHANGE_STAGE", label: "Mudar estágio" },
  { value: "CHANGE_STATUS", label: "Mudar status" },
  { value: "ASSIGN_TO", label: "Atribuir a" },
  { value: "CREATE_TASK", label: "Criar tarefa" },
  { value: "SEND_WHATSAPP", label: "Enviar WhatsApp" },
];

const STATUS_OPTIONS = [
  { value: "NEW", label: "Novo" },
  { value: "CONTACTED", label: "Contato feito" },
  { value: "QUALIFIED", label: "Qualificado" },
  { value: "PROPOSAL", label: "Proposta" },
  { value: "NEGOTIATION", label: "Negociação" },
  { value: "WON", label: "Ganho" },
  { value: "LOST", label: "Perdido" },
];

export function AutomationsSection({ tenantId }: { tenantId: string }) {
  const [rules, setRules] = useState<AutomationRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadRules = async () => {
    setLoading(true);
    try {
      const r = await listAutomationRules(tenantId);
      // Converter JsonValue para tipos apropriados
      setRules(
        r.map((rule) => ({
          id: rule.id,
          name: rule.name,
          enabled: rule.enabled,
          trigger: rule.trigger,
          triggerConfig:
            rule.triggerConfig && typeof rule.triggerConfig === "object" && !Array.isArray(rule.triggerConfig)
              ? (rule.triggerConfig as Record<string, unknown>)
              : null,
          actions: Array.isArray(rule.actions)
            ? (rule.actions as Array<Record<string, unknown>>)
            : [],
          order: rule.order,
        }))
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar automações");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRules();
  }, [tenantId]);

  const handleToggle = async (id: string, enabled: boolean) => {
    setSaving(true);
    try {
      await updateAutomationRule(id, tenantId, { enabled: !enabled });
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar automação");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir esta automação?")) return;
    setSaving(true);
    try {
      await deleteAutomationRule(id, tenantId);
      await loadRules();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir automação");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando automações…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Automações</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        {showForm && (
          <AutomationForm
            tenantId={tenantId}
            onSave={async (data) => {
              setSaving(true);
              try {
                await createAutomationRule(tenantId, {
                  ...data,
                  order: rules.length,
                });
                setShowForm(false);
                await loadRules();
              } catch (e) {
                setError(e instanceof Error ? e.message : "Erro ao criar automação");
              } finally {
                setSaving(false);
              }
            }}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {rules.length === 0 && !showForm ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">Nenhuma automação criada ainda.</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeira automação
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {rules.map((rule) => (
              <div
                key={rule.id}
                className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800"
              >
                <div className="flex-1">
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => handleToggle(rule.id, rule.enabled)}
                      disabled={saving}
                      className="text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-300"
                    >
                      {rule.enabled ? (
                        <Play className="h-4 w-4 text-success-500" />
                      ) : (
                        <Pause className="h-4 w-4" />
                      )}
                    </button>
                    <span className="font-medium text-neutral-900 dark:text-neutral-100">{rule.name}</span>
                    <span className="text-sm text-neutral-500">
                      ({TRIGGER_LABELS[rule.trigger]})
                    </span>
                  </div>
                  <p className="mt-1 text-xs text-neutral-500">
                    {Array.isArray(rule.actions) ? rule.actions.length : 0}{" "}
                    {Array.isArray(rule.actions) && rule.actions.length === 1 ? "ação" : "ações"}
                  </p>
                </div>
                <div className="flex items-center gap-1">
                  <button
                    onClick={() => setEditingId(rule.id)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
                  >
                    <Edit2 className="h-4 w-4" />
                  </button>
                  <button
                    onClick={() => handleDelete(rule.id)}
                    className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-error-600 dark:hover:bg-neutral-700"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            ))}
            {!showForm && (
              <Button onClick={() => setShowForm(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar automação
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function AutomationForm({
  tenantId,
  onSave,
  onCancel,
  saving,
  initialData,
}: {
  tenantId: string;
  onSave: (data: {
    name: string;
    enabled: boolean;
    trigger: AutomationTrigger;
    triggerConfig?: Record<string, unknown>;
    actions: Array<Record<string, unknown>>;
    order?: number;
  }) => void;
  onCancel: () => void;
  saving: boolean;
  initialData?: AutomationRule;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [enabled, setEnabled] = useState(initialData?.enabled ?? true);
  const [trigger, setTrigger] = useState<AutomationTrigger>(
    initialData?.trigger || "LEAD_CREATED"
  );
  const [triggerConfig, setTriggerConfig] = useState<Record<string, unknown>>(
    (initialData?.triggerConfig && typeof initialData.triggerConfig === "object" && !Array.isArray(initialData.triggerConfig))
      ? (initialData.triggerConfig as Record<string, unknown>)
      : {}
  );
  const [actions, setActions] = useState<Array<Record<string, unknown>>>(
    Array.isArray(initialData?.actions) ? initialData.actions : [{ type: "CREATE_TASK", title: "" }]
  );
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [users, setUsers] = useState<{ id: string; name: string }[]>([]);

  useEffect(() => {
    Promise.all([
      getPipelineWithStages(tenantId).then((p) => {
        if (p?.stages) setStages(p.stages);
      }),
      listUsers(tenantId).then(setUsers),
    ]);
  }, [tenantId]);

  const handleAddAction = () => {
    setActions([...actions, { type: "CREATE_TASK", title: "" }]);
  };

  const handleRemoveAction = (index: number) => {
    setActions(actions.filter((_, i) => i !== index));
  };

  const handleActionChange = (index: number, field: string, value: unknown) => {
    const newActions = [...actions];
    newActions[index] = { ...newActions[index], [field]: value };
    setActions(newActions);
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || actions.length === 0) return;

    onSave({
      name: name.trim(),
      enabled,
      trigger,
      triggerConfig: Object.keys(triggerConfig).length > 0 ? triggerConfig : undefined,
      actions,
      order: initialData?.order ?? 0,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
      <Input
        label="Nome da automação"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        placeholder="Ex: Atribuir leads do Meta automaticamente"
      />

      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Quando</label>
        <select
          value={trigger}
          onChange={(e) => setTrigger(e.target.value as AutomationTrigger)}
          className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
        >
          {Object.entries(TRIGGER_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
      </div>

      {/* Condições do trigger */}
      {(trigger === "LEAD_STAGE_CHANGED" || trigger === "LEAD_CREATED") && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Estágio específico (opcional)
          </label>
          <select
            value={(triggerConfig.stageId as string) || ""}
            onChange={(e) =>
              setTriggerConfig({ ...triggerConfig, stageId: e.target.value || undefined })
            }
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Qualquer estágio</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </div>
      )}

      {/* Ações */}
      <div>
        <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Ações</label>
        <div className="space-y-3">
          {actions.map((action, index) => (
            <ActionEditor
              key={index}
              action={action}
              index={index}
              stages={stages}
              users={users}
              onChange={(field, value) => handleActionChange(index, field, value)}
              onRemove={() => handleRemoveAction(index)}
            />
          ))}
          <Button type="button" variant="outline" onClick={handleAddAction}>
            <Plus className="mr-2 h-4 w-4" />
            Adicionar ação
          </Button>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="enabled"
          checked={enabled}
          onChange={(e) => setEnabled(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        <label htmlFor="enabled" className="text-sm text-neutral-700 dark:text-neutral-300">
          Automação ativa
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" isLoading={saving} disabled={!name.trim() || actions.length === 0}>
          {initialData ? "Salvar" : "Criar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function ActionEditor({
  action,
  index,
  stages,
  users,
  onChange,
  onRemove,
}: {
  action: Record<string, unknown>;
  index: number;
  stages: { id: string; name: string }[];
  users: { id: string; name: string }[];
  onChange: (field: string, value: unknown) => void;
  onRemove: () => void;
}) {
  const type = (action.type as string) || "CREATE_TASK";

  return (
    <div className="flex gap-2 rounded border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex-1 space-y-2">
        <select
          value={type}
          onChange={(e) => onChange("type", e.target.value)}
          className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
        >
          {ACTION_TYPES.map((at) => (
            <option key={at.value} value={at.value}>
              {at.label}
            </option>
          ))}
        </select>

        {type === "CHANGE_STAGE" && (
          <select
            value={(action.stageId as string) || ""}
            onChange={(e) => onChange("stageId", e.target.value)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            <option value="">Selecione o estágio</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        )}

        {type === "CHANGE_STATUS" && (
          <select
            value={(action.status as string) || ""}
            onChange={(e) => onChange("status", e.target.value)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            <option value="">Selecione o status</option>
            {STATUS_OPTIONS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        )}

        {type === "ASSIGN_TO" && (
          <select
            value={(action.userId as string) || ""}
            onChange={(e) => onChange("userId", e.target.value)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
          >
            <option value="">Selecione o usuário</option>
            {users.map((u) => (
              <option key={u.id} value={u.id}>
                {u.name}
              </option>
            ))}
          </select>
        )}

        {type === "CREATE_TASK" && (
          <>
            <Input
              value={(action.title as string) || ""}
              onChange={(e) => onChange("title", e.target.value)}
              placeholder="Título da tarefa"
              className="text-sm"
            />
            <input
              type="date"
              value={(action.dueAt as string) || ""}
              onChange={(e) => onChange("dueAt", e.target.value || undefined)}
              className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
              placeholder="Data de vencimento"
            />
          </>
        )}

        {type === "SEND_WHATSAPP" && (
          <textarea
            value={(action.message as string) || ""}
            onChange={(e) => onChange("message", e.target.value)}
            placeholder="Mensagem a enviar"
            className="w-full rounded-sm border border-neutral-300 bg-white px-2 py-1 text-sm dark:border-neutral-600 dark:bg-neutral-800"
            rows={2}
          />
        )}
      </div>
      <button
        type="button"
        onClick={onRemove}
        className="text-neutral-400 hover:text-error-600"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}
