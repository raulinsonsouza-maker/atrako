import catalog from "./br-municipios.json";

type Estado = { sigla: string; nome: string; cidades: string[] };

function fold(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}

const estados = (catalog as { estados: Estado[] }).estados;
const citiesByUf = new Map<string, Map<string, string>>();
const ufByName = new Map<string, string>();
const nameByUf = new Map<string, string>();
const cityHits = new Map<string, number>();

for (const estado of estados) {
  const uf = estado.sigla.toUpperCase();
  ufByName.set(fold(estado.nome), uf);
  nameByUf.set(uf, estado.nome);
  const cities = new Map<string, string>();
  for (const cidade of estado.cidades) {
    const key = fold(cidade);
    cities.set(key, cidade);
    cityHits.set(key, (cityHits.get(key) ?? 0) + 1);
  }
  citiesByUf.set(uf, cities);
}

const uniqueCity = new Map<string, { uf: string; name: string }>();
for (const estado of estados) {
  const uf = estado.sigla.toUpperCase();
  for (const cidade of estado.cidades) {
    const key = fold(cidade);
    if (cityHits.get(key) === 1) uniqueCity.set(key, { uf, name: cidade });
  }
}

export function stateName(uf: string | null | undefined): string {
  if (!uf) return "Sem local";
  return nameByUf.get(uf.toUpperCase()) ?? uf;
}

export type NormalizedPlace = {
  stateUf: string | null;
  cityName: string | null;
  cityRaw: string | null;
};

/** Casa UF e município do texto da loja com o catálogo do IBGE. Sem casar, guarda o texto cru. */
export function normalizePlace(
  city: string | null | undefined,
  state: string | null | undefined,
): NormalizedPlace {
  const rawState = (state ?? "").trim();
  let cityText = (city ?? "").trim();
  let uf: string | null = null;

  const stateKey = fold(rawState);
  if (stateKey.length === 2 && citiesByUf.has(stateKey.toUpperCase())) {
    uf = stateKey.toUpperCase();
  } else if (ufByName.has(stateKey)) {
    uf = ufByName.get(stateKey) ?? null;
  } else {
    const token = rawState.match(/\b([A-Za-z]{2})\b/);
    if (token && citiesByUf.has(token[1].toUpperCase())) uf = token[1].toUpperCase();
  }

  const suffix = cityText.match(/^(.*?)[\s,/-]+([A-Za-z]{2})$/);
  if (suffix && citiesByUf.has(suffix[2].toUpperCase())) {
    uf = uf ?? suffix[2].toUpperCase();
    cityText = suffix[1].trim();
  }

  const key = fold(cityText);
  let cityName: string | null = null;
  if (key) {
    if (uf) cityName = citiesByUf.get(uf)?.get(key) ?? null;
    if (!cityName) {
      const unique = uniqueCity.get(key);
      if (unique && (!uf || unique.uf === uf)) {
        cityName = unique.name;
        uf = uf ?? unique.uf;
      }
    }
  }

  if (!uf && !cityText) return { stateUf: null, cityName: null, cityRaw: null };
  return {
    stateUf: uf,
    cityName,
    cityRaw: cityName || !cityText ? null : cityText.slice(0, 120),
  };
}
