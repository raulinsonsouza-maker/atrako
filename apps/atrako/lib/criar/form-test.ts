import type { FormField, FormStep } from "@atrako/forms";
import { isValidBrPhone, isValidEmail } from "@/lib/format/br-input";
import { isValidBrCity, isValidBrUf } from "@/lib/geo/br";

/** Validação de respostas de formulário (modo teste e envio real usam as mesmas regras). */

export type AnswerError = { fieldId: string; label: string; message: string };

const DATE_RE = /^\d{2}\/\d{2}(\/\d{4})?$/;

export function flattenFields(steps: FormStep[] | null | undefined): FormField[] {
  return (steps ?? []).flatMap((s) => s.fields ?? []);
}

export function validateFormAnswers(
  fields: FormField[],
  answers: Array<{ fieldId: string; value: string }>,
): { ok: boolean; errors: AnswerError[]; values: Record<string, string> } {
  const values: Record<string, string> = {};
  for (const a of answers) {
    if (a && typeof a.fieldId === "string") values[a.fieldId] = typeof a.value === "string" ? a.value.trim() : "";
  }
  const errors: AnswerError[] = [];
  for (const f of fields) {
    const v = values[f.id] ?? "";
    const fail = (message: string) => errors.push({ fieldId: f.id, label: f.label, message });
    if (!v) {
      if (f.required) fail(f.type === "consent" ? "Precisa aceitar." : "Campo obrigatório.");
      continue;
    }
    if (f.type === "email" && !isValidEmail(v)) fail("E-mail inválido.");
    else if (f.type === "phone" && !isValidBrPhone(v)) fail("Telefone precisa de DDD + número.");
    else if (f.type === "number" && !Number.isFinite(Number(v.replace(",", ".")))) fail("Precisa ser um número.");
    else if (f.type === "date" && !DATE_RE.test(v)) fail("Data no formato DD/MM.");
    else if (f.type === "choice" && f.options?.length && !f.options.includes(v)) fail("Opção inexistente.");
    else if (f.type === "consent" && v !== "sim") fail("Consentimento inválido.");
    else if (f.type === "state" && !isValidBrUf(v.toUpperCase())) fail("Estado inválido.");
    else if (f.type === "city") {
      const uf = (values[f.dependsOn || "state"] ?? "").toUpperCase();
      if (!isValidBrCity(uf, v)) fail("Cidade inválida para o estado.");
    }
  }
  return { ok: errors.length === 0, errors, values };
}

/** Respostas de exemplo plausíveis para o teste automático. */
export function sampleAnswers(fields: FormField[]): Array<{ fieldId: string; value: string }> {
  const hasState = fields.some((f) => f.type === "state" || f.id === "state");
  return fields.map((f) => {
    const label = f.label.toLowerCase();
    let value = "Teste do assistente";
    if (f.type === "email") value = "maria.teste@exemplo.com.br";
    else if (f.type === "phone") value = "(11) 98765-4321";
    else if (f.type === "number") value = "2";
    else if (f.type === "date") value = "15/03";
    else if (f.type === "consent") value = "sim";
    else if (f.type === "choice") value = f.options?.[0] ?? "";
    else if (f.type === "state" || f.id === "state") value = "SP";
    else if (f.type === "city" || f.id === "city") value = hasState ? "São Paulo" : "São Paulo";
    else if (/nome|name/.test(label)) value = "Maria Teste";
    else if (/empresa|loja|neg[oó]cio/.test(label)) value = "Loja Exemplo";
    else if (/cidade/.test(label)) value = "São Paulo";
    return { fieldId: f.id, value };
  });
}
