/**
 * Estados e cidades BR — dados de
 * https://github.com/egermano/cidades-e-estados-brasileiros (MIT).
 */

import estadosMap from "./estados.json";
import cidadesPorUf from "./cidades-por-uf.json";

export type BrUf = keyof typeof cidadesPorUf;

const CIDADES = cidadesPorUf as Record<string, string[]>;
const ESTADOS = estadosMap as Record<string, string>;

export const BR_UF_OPTIONS = Object.keys(ESTADOS)
  .sort((a, b) => ESTADOS[a].localeCompare(ESTADOS[b], "pt-BR"))
  .map((uf) => ({ value: uf, label: `${uf} — ${ESTADOS[uf]}` }));

export function brStateLabel(uf: string) {
  return ESTADOS[uf] ? `${uf} — ${ESTADOS[uf]}` : uf;
}

export function brCitiesForUf(uf: string): string[] {
  return CIDADES[uf] ?? [];
}

export function isValidBrUf(uf: string) {
  return Boolean(ESTADOS[uf]);
}

export function isValidBrCity(uf: string, city: string) {
  if (!uf || !city) return false;
  const list = CIDADES[uf];
  if (!list) return false;
  const needle = city.trim().toLowerCase();
  return list.some((c) => c.toLowerCase() === needle);
}
