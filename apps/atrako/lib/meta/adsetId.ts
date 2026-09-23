export function isValidMetaAdsetId(value: string) {
  return /^\d{1,64}$/.test(value);
}