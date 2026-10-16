/** Máscaras e validação de input BR para CaptureForm / LP. */

export function onlyDigits(value: string) {
  return value.replace(/\D/g, "");
}

/** Mesma regra do hub de pessoa (typos comuns de domínio corrigidos na normalização server-side). */
const EMAIL_RE =
  /^[^\s@<>()[\],;:"]+@[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)*\.[a-z]{2,}$/i;

export function isValidEmail(raw: string) {
  const email = raw.trim().toLowerCase().replace(/\s+/g, "");
  return email.length >= 6 && email.length <= 255 && EMAIL_RE.test(email);
}

/** Máscara telefone/WhatsApp: (00) 0000-0000 ou (00) 00000-0000 */
export function maskBrPhone(raw: string) {
  const digits = onlyDigits(raw).slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  if (digits.length <= 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/** Máscara data: DD/MM ou DD/MM/AAAA */
export function maskBrDate(raw: string) {
  const digits = onlyDigits(raw).slice(0, 8);
  if (digits.length <= 2) return digits;
  if (digits.length <= 4) return `${digits.slice(0, 2)}/${digits.slice(2)}`;
  return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`;
}

/** Celular BR com DDD: 10 (fixo) ou 11 (celular) dígitos. */
export function isValidBrPhone(raw: string) {
  const digits = onlyDigits(raw);
  return digits.length === 10 || digits.length === 11;
}
