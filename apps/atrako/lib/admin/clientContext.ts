export const COMMERCIAL_CONTEXT_FIELDS = [
  "produtoServico",
  "modeloNegocio",
  "publicoAlvo",
  "objetivoProjeto",
  "diferenciais",
  "observacoesAnaliticas",
] as const;

export type CommercialContextField = (typeof COMMERCIAL_CONTEXT_FIELDS)[number];
export const COMMERCIAL_CONTEXT_MAX_LENGTH = 1000;

const CONTROL_CHARACTERS = /[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g;

export type CommercialContext = Record<CommercialContextField, string | null>;

function normalizeContextValue(value: unknown, field: CommercialContextField): string | null {
  if (value == null) return null;
  if (typeof value !== "string") {
    throw new Error(`${field} deve ser um texto`);
  }
  const normalized = value.replace(CONTROL_CHARACTERS, " ").replace(/\s+/g, " ").trim();
  if (normalized.length > COMMERCIAL_CONTEXT_MAX_LENGTH) {
    throw new Error(`${field} excede o limite de ${COMMERCIAL_CONTEXT_MAX_LENGTH} caracteres`);
  }
  return normalized || null;
}

export function validateCommercialContext(
  input: Record<string, unknown>,
  existing?: Partial<CommercialContext>,
): CommercialContext {
  return Object.fromEntries(COMMERCIAL_CONTEXT_FIELDS.map((field) => [
    field,
    field in input ? normalizeContextValue(input[field], field) : existing?.[field] ?? null,
  ])) as CommercialContext;
}