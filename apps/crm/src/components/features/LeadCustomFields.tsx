"use client";

import { useState, useEffect } from "react";
import { listCustomFields, getLeadCustomFieldValues, setLeadCustomFieldValues } from "@/server/actions/customField";
import { Input } from "@/design/components";
import { CustomFieldType } from "@prisma/client";

interface CustomField {
  id: string;
  name: string;
  type: CustomFieldType;
  required: boolean;
  options: string | null;
}

interface LeadCustomFieldsProps {
  leadId: string;
  tenantId: string;
  onUpdate?: () => void;
}

export function LeadCustomFields({ leadId, tenantId, onUpdate }: LeadCustomFieldsProps) {
  const [fields, setFields] = useState<CustomField[]>([]);
  const [values, setValues] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadData();
  }, [leadId, tenantId]);

  const loadData = async () => {
    setLoading(true);
    try {
      const [customFields, fieldValues] = await Promise.all([
        listCustomFields(tenantId),
        getLeadCustomFieldValues(leadId, tenantId),
      ]);
      setFields(customFields);
      
      const valuesMap: Record<string, string> = {};
      fieldValues.forEach((fv) => {
        valuesMap[fv.customFieldId] = fv.value || "";
      });
      setValues(valuesMap);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao carregar campos");
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (fieldId: string, value: string) => {
    setValues((prev) => ({ ...prev, [fieldId]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      const valuesToSave: Record<string, string | null> = {};
      fields.forEach((field) => {
        valuesToSave[field.id] = values[field.id] || null;
      });
      
      await setLeadCustomFieldValues(leadId, valuesToSave, tenantId);
      onUpdate?.();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro ao salvar campos");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <p className="text-sm text-neutral-500">Carregando campos personalizados…</p>;
  }

  if (fields.length === 0) {
    return null;
  }

  return (
    <div className="space-y-4">
      {error && <p className="text-sm text-error-600">{error}</p>}
      
      {fields.map((field) => (
        <CustomFieldInput
          key={field.id}
          field={field}
          value={values[field.id] || ""}
          onChange={(value) => handleChange(field.id, value)}
        />
      ))}
      
      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="rounded-sm bg-primary-500 px-4 py-2 text-sm font-medium text-white hover:bg-primary-600 disabled:opacity-50"
      >
        {saving ? "Salvando…" : "Salvar campos personalizados"}
      </button>
    </div>
  );
}

function CustomFieldInput({
  field,
  value,
  onChange,
}: {
  field: CustomField;
  value: string;
  onChange: (value: string) => void;
}) {
  const options = field.options ? (JSON.parse(field.options) as string[]) : [];

  switch (field.type) {
    case "TEXT":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "TEXTAREA":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {field.name + (field.required ? " *" : "")}
          </label>
          <textarea
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
            rows={3}
          />
        </div>
      );

    case "NUMBER":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          type="number"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "DATE":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          type="date"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "EMAIL":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          type="email"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "PHONE":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          type="tel"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "URL":
      return (
        <Input
          label={field.name + (field.required ? " *" : "")}
          type="url"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          required={field.required}
        />
      );

    case "SELECT":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {field.name + (field.required ? " *" : "")}
          </label>
          <select
            value={value}
            onChange={(e) => onChange(e.target.value)}
            required={field.required}
            className="w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100"
          >
            <option value="">Selecione...</option>
            {options.map((opt) => (
              <option key={opt} value={opt}>
                {opt}
              </option>
            ))}
          </select>
        </div>
      );

    case "RADIO":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {field.name + (field.required ? " *" : "")}
          </label>
          <div className="space-y-2">
            {options.map((opt) => (
              <label key={opt} className="flex items-center gap-2">
                <input
                  type="radio"
                  name={`field-${field.id}`}
                  value={opt}
                  checked={value === opt}
                  onChange={(e) => onChange(e.target.value)}
                  required={field.required}
                  className="h-4 w-4"
                />
                <span className="text-sm text-neutral-700 dark:text-neutral-300">{opt}</span>
              </label>
            ))}
          </div>
        </div>
      );

    case "CHECKBOX":
      return (
        <div>
          <label className="mb-1 block text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {field.name + (field.required ? " *" : "")}
          </label>
          <div className="space-y-2">
            {options.map((opt) => {
              const checked = value.split(",").includes(opt);
              return (
                <label key={opt} className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={(e) => {
                      const current = value.split(",").filter((v) => v);
                      if (e.target.checked) {
                        onChange([...current, opt].join(","));
                      } else {
                        onChange(current.filter((v) => v !== opt).join(","));
                      }
                    }}
                    className="h-4 w-4"
                  />
                  <span className="text-sm text-neutral-700 dark:text-neutral-300">{opt}</span>
                </label>
              );
            })}
          </div>
        </div>
      );

    default:
      return null;
  }
}
