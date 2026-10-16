"use client";

import type { FormField } from "@atrako/forms";
import { OptionChip, PillSelect } from "@/components/ui";
import { TextField } from "@/components/ui/text-field";
import { isValidBrPhone, isValidEmail, maskBrDate, maskBrPhone } from "@/lib/format/br-input";
import { BR_UF_OPTIONS, brCitiesForUf, isValidBrCity, isValidBrUf } from "@/lib/geo/br";

const fieldClass =
  "mt-3 h-12 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-5 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Props = {
  field: FormField;
  value: string;
  answers: Record<string, string>;
  onChange: (value: string) => void;
  /** typeform / passo a passo: tipografia maior */
  variant?: "wizard" | "block";
  autoFocus?: boolean;
  /** No bloco LP o label fica fora (TextField); no wizard o título da página é a pergunta. */
  hideLabel?: boolean;
};

export function FormFieldControl({
  field,
  value,
  answers,
  onChange,
  variant = "wizard",
  autoFocus,
  hideLabel,
}: Props) {
  const stateKey = field.dependsOn || "state";
  const uf = (answers[stateKey] ?? "").trim().toUpperCase();
  const optional = field.required ? "" : " (opcional)";

  if (field.type === "consent") {
    return (
      <button
        type="button"
        role="checkbox"
        aria-checked={value === "sim"}
        onClick={() => onChange(value === "sim" ? "" : "sim")}
        className={`flex w-full items-start gap-3 rounded-[var(--radius-xs)] border px-4 py-3.5 text-left type-caption active:scale-[0.99] ${
          value === "sim"
            ? "border-[var(--primary)] bg-[var(--primary-glow)] text-[var(--ink)]"
            : "border-[var(--hairline)] bg-[var(--canvas-parchment)] text-[var(--ink-muted-80)]"
        } ${variant === "wizard" ? "mt-6" : ""}`}
      >
        <span
          className={`mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-[var(--radius-xs)] border type-fine-print ${
            value === "sim"
              ? "border-[var(--primary)] bg-[var(--primary)] text-[var(--on-primary)]"
              : "border-[var(--hairline)] bg-[var(--canvas)]"
          }`}
          aria-hidden
        >
          {value === "sim" ? "✓" : ""}
        </span>
        <span>{field.label}</span>
      </button>
    );
  }

  if (field.type === "choice" && field.options?.length) {
    const chipRow = variant === "block" && field.options.every((o) => o.length <= 18);
    if (chipRow) {
      return (
        <div>
          {!hideLabel ? (
            <span className="capture-form-field-label type-caption-strong">
              {field.label}
              {optional}
            </span>
          ) : null}
          <div className="capture-form-chips">
            {field.options.map((opt) => (
              <OptionChip key={opt} selected={value === opt} onClick={() => onChange(opt)}>
                {opt}
              </OptionChip>
            ))}
          </div>
        </div>
      );
    }
    return (
      <div className={variant === "block" ? "" : "mt-6"}>
        {!hideLabel && variant === "block" ? (
          <span className="capture-form-field-label type-caption-strong">
            {field.label}
            {optional}
          </span>
        ) : null}
        <div className="flex flex-col gap-2">
          {field.options.map((opt) => (
            <button
              key={opt}
              type="button"
              onClick={() => onChange(opt)}
              className={`rounded-[var(--radius-xs)] border px-5 py-3.5 text-left type-body active:scale-[0.99] ${
                value === opt
                  ? "border-[var(--primary)] bg-[var(--primary-glow)] text-[var(--primary)]"
                  : "border-[var(--hairline)] bg-[var(--canvas)] text-[var(--ink)]"
              }`}
            >
              {opt}
            </button>
          ))}
        </div>
      </div>
    );
  }

  if (field.type === "state" || field.type === "city") {
    const cities = uf ? brCitiesForUf(uf).map((name) => ({ value: name, label: name })) : [];
    const isCity = field.type === "city";
    return (
      <div>
        {!hideLabel ? (
          <span className="capture-form-field-label type-caption-strong">
            {field.label}
            {optional}
          </span>
        ) : null}
        <PillSelect
          size="field"
          value={value}
          onChange={onChange}
          options={isCity ? cities : BR_UF_OPTIONS}
          placeholder={
            isCity
              ? uf
                ? "Digite a cidade"
                : "Escolha o estado antes"
              : "Digite o estado"
          }
          aria-label={field.label}
          disabled={isCity && !uf}
          searchable
          searchPlaceholder={isCity ? "Buscar cidade…" : "Buscar estado…"}
        />
      </div>
    );
  }

  if (variant === "block" && (field.type === "text" || field.type === "email" || field.type === "phone" || field.type === "number" || field.type === "date")) {
    return (
      <TextField
        label={
          hideLabel ? (
            <span className="sr-only">{field.label}</span>
          ) : (
            <>
              {field.label}
              {optional}
            </>
          )
        }
        autoFocus={autoFocus}
        type={field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text"}
        inputMode={
          field.type === "phone" ? "tel" : field.type === "number" || field.type === "date" ? "numeric" : field.type === "email" ? "email" : undefined
        }
        autoComplete={
          field.type === "email" ? "email" : field.type === "phone" ? "tel" : /nome|name/i.test(field.label) ? "name" : undefined
        }
        placeholder={
          field.type === "date" ? "DD/MM" : field.type === "phone" ? "(11) 99999-9999" : field.type === "email" ? "nome@email.com" : undefined
        }
        maxLength={field.type === "phone" ? 15 : field.type === "date" ? 10 : undefined}
        value={value}
        onChange={(e) => {
          const raw = e.target.value;
          if (field.type === "phone") onChange(maskBrPhone(raw));
          else if (field.type === "date") onChange(maskBrDate(raw));
          else onChange(raw);
        }}
        required={field.required}
      />
    );
  }

  return (
    <input
      autoFocus={autoFocus}
      className={fieldClass}
      type={
        field.type === "email" ? "email" : field.type === "phone" ? "tel" : field.type === "number" ? "number" : "text"
      }
      inputMode={
        field.type === "phone" ? "tel" : field.type === "number" || field.type === "date" ? "numeric" : undefined
      }
      autoComplete={
        field.type === "email" ? "email" : field.type === "phone" ? "tel" : /nome|name/i.test(field.label) ? "name" : undefined
      }
      placeholder={
        field.type === "date" ? "DD/MM" : field.type === "phone" ? "(11) 99999-9999" : field.type === "email" ? "nome@email.com" : undefined
      }
      maxLength={field.type === "phone" ? 15 : field.type === "date" ? 10 : undefined}
      value={value}
      onChange={(e) => {
        const raw = e.target.value;
        if (field.type === "phone") onChange(maskBrPhone(raw));
        else if (field.type === "date") onChange(maskBrDate(raw));
        else onChange(raw);
      }}
      required={field.required}
    />
  );
}

/** Valida um campo isolado (UI). */
export function isFieldValueValid(field: FormField, value: string, answers: Record<string, string>): boolean {
  const v = value.trim();
  if (!v) return !field.required;
  if (field.type === "email") return isValidEmail(v);
  if (field.type === "phone") return isValidBrPhone(v);
  if (field.type === "date") return /^\d{2}\/\d{2}(\/\d{4})?$/.test(v);
  if (field.type === "consent") return v === "sim";
  if (field.type === "choice" && field.options?.length) return field.options.includes(v);
  if (field.type === "state") return isValidBrUf(v.toUpperCase());
  if (field.type === "city") {
    const stateKey = field.dependsOn || "state";
    const cityUf = (answers[stateKey] ?? "").trim().toUpperCase();
    return isValidBrCity(cityUf, v);
  }
  if (field.type === "number") return Number.isFinite(Number(v.replace(",", ".")));
  return true;
}
