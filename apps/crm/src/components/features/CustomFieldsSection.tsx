"use client";

import { useState, useEffect } from "react";
import {
  listCustomFields,
  createCustomField,
  updateCustomField,
  deleteCustomField,
} from "@/server/actions/customField";
import { Button, Input, Card, CardHeader, CardTitle, CardContent } from "@/design/components";
import { Plus, X, Edit2, Trash2, GripVertical } from "lucide-react";
import { CustomFieldType } from "@prisma/client";

interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: string | null;
  order: number;
}

const FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  TEXT: "Texto",
  TEXTAREA: "Área de texto",
  NUMBER: "Número",
  DATE: "Data",
  SELECT: "Seleção",
  RADIO: "Radio",
  CHECKBOX: "Checkbox",
  EMAIL: "E-mail",
  PHONE: "Telefone",
  URL: "URL",
};

const FIELD_TYPES_WITH_OPTIONS: CustomFieldType[] = ["SELECT", "RADIO", "CHECKBOX"];

export function CustomFieldsSection({ tenantId }: { tenantId: string }) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadFields = async () => {
    setLoading(true);
    try {
      const f = await listCustomFields(tenantId);
      setFields(f);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadFields();
  }, [tenantId]);

  const handleCreate = async (data: {
    name: string;
    type: CustomFieldType;
    required: boolean;
    options?: string;
  }) => {
    setSaving(true);
    setError(null);
    try {
      await createCustomField(tenantId, {
        ...data,
        order: fields.length,
      });
      setShowForm(false);
      await loadFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao criar campo");
    } finally {
      setSaving(false);
    }
  };

  const handleUpdate = async (
    id: string,
    data: {
      name: string;
      type: CustomFieldType;
      required: boolean;
      options?: string;
    }
  ) => {
    setSaving(true);
    setError(null);
    try {
      await updateCustomField(id, tenantId, data);
      setEditingId(null);
      await loadFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao atualizar campo");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Tem certeza que deseja excluir este campo? Todos os valores serão removidos.")) return;
    setSaving(true);
    setError(null);
    try {
      await deleteCustomField(id, tenantId);
      await loadFields();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao excluir campo");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p className="text-neutral-500">Carregando campos…</p>;

  return (
    <Card>
      <CardHeader>
        <CardTitle>Campos Personalizados</CardTitle>
      </CardHeader>
      <CardContent>
        {error && <p className="mb-4 text-sm text-error-600">{error}</p>}

        {/* Formulário de criação */}
        {showForm && (
          <CustomFieldForm
            onSave={(data) => handleCreate(data)}
            onCancel={() => setShowForm(false)}
            saving={saving}
          />
        )}

        {/* Lista de campos */}
        {fields.length === 0 && !showForm ? (
          <div className="space-y-4">
            <p className="text-sm text-neutral-500">Nenhum campo personalizado criado ainda.</p>
            <Button onClick={() => setShowForm(true)}>
              <Plus className="mr-2 h-4 w-4" />
              Criar primeiro campo
            </Button>
          </div>
        ) : (
          <div className="space-y-3">
            {fields.map((field) => (
              <CustomFieldItem
                key={field.id}
                field={field}
                editing={editingId === field.id}
                onEdit={() => setEditingId(field.id)}
                onCancel={() => setEditingId(null)}
                onSave={(data) => handleUpdate(field.id, data)}
                onDelete={() => handleDelete(field.id)}
                saving={saving}
              />
            ))}
            {!showForm && (
              <Button onClick={() => setShowForm(true)} variant="outline">
                <Plus className="mr-2 h-4 w-4" />
                Adicionar campo
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function CustomFieldForm({
  onSave,
  onCancel,
  saving,
  initialData,
}: {
  onSave: (data: { name: string; type: CustomFieldType; required: boolean; options?: string }) => void;
  onCancel: () => void;
  saving: boolean;
  initialData?: CustomField;
}) {
  const [name, setName] = useState(initialData?.name || "");
  const [type, setType] = useState<CustomFieldType>(initialData?.type || "TEXT");
  const [required, setRequired] = useState(initialData?.required || false);
  const [options, setOptions] = useState(initialData?.options || "");

  const needsOptions = FIELD_TYPES_WITH_OPTIONS.includes(type);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    let optionsValue: string | undefined;
    if (needsOptions) {
      if (!options.trim()) {
        alert("Campos de seleção precisam ter opções definidas");
        return;
      }
      try {
        const parsed = JSON.parse(options);
        if (!Array.isArray(parsed) || parsed.length === 0) {
          alert("Options deve ser um JSON array não vazio");
          return;
        }
        optionsValue = options;
      } catch {
        alert("Options deve ser um JSON array válido (ex: [\"Opção 1\", \"Opção 2\"])");
        return;
      }
    }

    onSave({
      name: name.trim(),
      type,
      required,
      options: optionsValue,
    });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-6 space-y-4 rounded-lg border border-neutral-200 bg-neutral-50 p-4 dark:border-neutral-700 dark:bg-neutral-800/50">
      <div className="grid grid-cols-2 gap-4">
        <Input
          label="Nome do campo"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
          placeholder="Ex: Empresa"
        />
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">Tipo</label>
          <select
            value={type}
            onChange={(e) => setType(e.target.value as CustomFieldType)}
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            {Object.entries(FIELD_TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {needsOptions && (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            Opções (JSON array)
          </label>
          <textarea
            value={options}
            onChange={(e) => setOptions(e.target.value)}
            placeholder='["Opção 1", "Opção 2", "Opção 3"]'
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 font-mono text-sm dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            rows={3}
          />
          <p className="mt-1 text-xs text-neutral-500">
            Digite um array JSON com as opções disponíveis
          </p>
        </div>
      )}

      <div className="flex items-center gap-2">
        <input
          type="checkbox"
          id="required"
          checked={required}
          onChange={(e) => setRequired(e.target.checked)}
          className="h-4 w-4 rounded border-neutral-300"
        />
        <label htmlFor="required" className="text-sm text-neutral-700 dark:text-neutral-300">
          Campo obrigatório
        </label>
      </div>

      <div className="flex gap-2">
        <Button type="submit" isLoading={saving} disabled={!name.trim()}>
          {initialData ? "Salvar" : "Criar"}
        </Button>
        <Button type="button" variant="outline" onClick={onCancel} disabled={saving}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

function CustomFieldItem({
  field,
  editing,
  onEdit,
  onCancel,
  onSave,
  onDelete,
  saving,
}: {
  field: CustomField;
  editing: boolean;
  onEdit: () => void;
  onCancel: () => void;
  onSave: (data: { name: string; type: CustomFieldType; required: boolean; options?: string }) => void;
  onDelete: () => void;
  saving: boolean;
}) {
  if (editing) {
    return (
      <CustomFieldForm
        initialData={field}
        onSave={onSave}
        onCancel={onCancel}
        saving={saving}
      />
    );
  }

  return (
    <div className="flex items-center justify-between rounded-lg border border-neutral-200 bg-white p-3 dark:border-neutral-700 dark:bg-neutral-800">
      <div className="flex items-center gap-3">
        <GripVertical className="h-4 w-4 text-neutral-400" />
        <div>
          <span className="font-medium text-neutral-900 dark:text-neutral-100">{field.name}</span>
          <span className="ml-2 text-sm text-neutral-500">
            ({FIELD_TYPE_LABELS[field.type]})
            {field.required && <span className="text-error-600"> *</span>}
          </span>
        </div>
      </div>
      <div className="flex items-center gap-1">
        <button
          onClick={onEdit}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-neutral-700 dark:hover:bg-neutral-700"
          title="Editar"
        >
          <Edit2 className="h-4 w-4" />
        </button>
        <button
          onClick={onDelete}
          className="rounded p-1 text-neutral-500 hover:bg-neutral-100 hover:text-error-600 dark:hover:bg-neutral-700"
          title="Excluir"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </div>
  );
}
