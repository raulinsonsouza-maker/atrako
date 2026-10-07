import type { FormField, FormStep } from "@atrako/forms";

/** Validação de respostas de formulário (modo teste e envio real usam as mesmas regras). */

export type AnswerError = { fieldId: string; label: string; message: string };

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i;
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
    if (f.type === "email" && !EMAIL_RE.test(v)) fail("E-mail inválido.");
    else if (f.type === "phone" && v.replace(/\D/g, "").length < 10) fail("Telefone precisa de DDD + número.");
    else if (f.type === "number" && !Number.isFinite(Number(v.replace(",", ".")))) fail("Precisa ser um número.");
    else if (f.type === "date" && !DATE_RE.test(v)) fail("Data no formato DD/MM.");
    else if (f.type === "choice" && f.options?.length && !f.options.includes(v)) fail("Opção inexistente.");
    else if (f.type === "consent" && v !== "sim") fail("Consentimento inválido.");
  }
  return { ok: errors.length === 0, errors, values };
}

/** Respostas de exemplo plausíveis para o teste automático. */
export function sampleAnswers(fields: FormField[]): Array<{ fieldId: string; value: string }> {
  return fields.map((f) => {
    const label = f.label.toLowerCase();
    let value = "Teste do assistente";
    if (f.type === "email") value = "maria.teste@exemplo.com.br";
    else if (f.type === "phone") value = "(11) 98765-4321";
    else if (f.type === "number") value = "2";
    else if (f.type === "date") value = "15/03";
    else if (f.type === "consent") value = "sim";
    else if (f.type === "choice") value = f.options?.[0] ?? "";
    else if (/nome|name/.test(label)) value = "Maria Teste";
    else if (/empresa|loja|neg[oó]cio/.test(label)) value = "Loja Exemplo";
    else if (/cidade/.test(label)) value = "São Paulo";
    return { fieldId: f.id, value };
  });
}
