export const HOTEL_FAZENDA_SAO_JOAO_SLUG = "hotel-fazenda-sao-joao";
export const TERTULIA_SLUG = "tertulia";
export const VARELLA_MOTOS_SLUG = "varella-motos";
export const MIGUEL_IMOVEIS_SLUG = "miguel-imoveis";
export const DR_FERNANDO_GUENA_SLUG = "dr-fernando-guena";
export const CLINICA_E_SPA_SLUG = "clinica-e-spa-vida-natural";
export const DOR_SLUG = "d-or";
export const GRANAROLO_SLUG = "granarolo";
export const FLORIEN_SLUG = "florien-fitoativos";
export const ACADEMY_AMERICANA_SLUG = "academy-americana";
export const MIRANTE_INCORPORADORA_SLUG = "mirante-incorporadora";
export const VITO_BALDUCCI_SLUG = "vito-balducci";
export const KOMBUCHA_DA_CA_SLUG = "kombucha-da-ca";
export const BE_BLUE_SCHOOL_SLUG = "be-blue-school";
export const SOU_ICARAI_SLUG = "sou-icarai";

export type ClientIdentity = {
  nome?: string | null;
  slug?: string | null;
  perfilPanel?: string | null;
};

function normalizeText(value?: string | null) {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function isHotelFazendaSaoJoao(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "hotel") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === HOTEL_FAZENDA_SAO_JOAO_SLUG ||
    slug === "conta-hotel" ||
    nome === "hotel fazenda sao joao" ||
    nome === "resort fazenda sao joao" ||
    nome === "conta hotel"
  );
}

export function isTertulia(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "tertulia") return true;
  if (client.perfilPanel === "restaurante") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return slug === TERTULIA_SLUG || nome === "tertulia";
}

export function isVarellaMotos(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "varella") return true;
  if (client.perfilPanel === "concessionaria") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return slug === VARELLA_MOTOS_SLUG || nome === "varella motos";
}

export function isMiguelImoveis(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "miguel-imoveis") return true;
  if (client.perfilPanel === "imoveis") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === MIGUEL_IMOVEIS_SLUG ||
    nome === "miguel imoveis" ||
    nome === "miguel imoveis anuncio" ||
    slug.includes("miguel") && slug.includes("imoveis")
  );
}

export function isDrFernandoGuena(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "dr-fernando-guena") return true;
  if (client.perfilPanel === "medico") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === DR_FERNANDO_GUENA_SLUG ||
    nome === "dr. fernando guena" ||
    nome === "dr fernando guena" ||
    nome === "fernando guena"
  );
}

export function isClinicaESpa(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "clinica-e-spa") return true;
  if (client.perfilPanel === "clinica") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === CLINICA_E_SPA_SLUG ||
    nome === "clinica e spa vida natural" ||
    (slug.includes("clinica") && slug.includes("spa"))
  );
}

export function isDor(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "d-or") return true;
  if (client.perfilPanel === "ecommerce") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return slug === DOR_SLUG || nome === "d'or" || nome === "dor";
}

export function isGranarolo(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "granarolo") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return slug === GRANAROLO_SLUG || nome === "granarolo";
}

export function isFlorien(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "florien") return true;
  if (client.perfilPanel === "instagram-visitas") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === FLORIEN_SLUG ||
    nome === "florien fitoativos" ||
    nome === "florien"
  );
}

export function isAcademyAmericana(client?: ClientIdentity | null) {
  if (!client) return false;
  // generic template value
  if (client.perfilPanel === "academy-americana") return true;
  if (client.perfilPanel === "academia") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === ACADEMY_AMERICANA_SLUG ||
    nome === "academy americana" ||
    slug.includes("academy") && slug.includes("americana")
  );
}

export function isVitoBalducci(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "vito-balducci") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === VITO_BALDUCCI_SLUG ||
    nome === "vito balducci"
  );
}

export function isKombucha(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "kombucha") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === KOMBUCHA_DA_CA_SLUG ||
    nome === "kombucha da ca" ||
    nome === "kombucha da cá"
  );
}

export function isBeBlueSchool(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "beblue") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === BE_BLUE_SCHOOL_SLUG ||
    nome === "be blue school"
  );
}

export function isSouIcarai(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "sou-icarai") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === SOU_ICARAI_SLUG ||
    nome === "sou + icarai" ||
    nome === "sou icarai" ||
    (slug.includes("sou") && slug.includes("icara"))
  );
}

export function isMiranteIncorporadora(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "mirante-incorporadora") return true;
  if (client.perfilPanel === "mirante") return true;

  const slug = normalizeText(client.slug);
  const nome = normalizeText(client.nome);

  return (
    slug === MIRANTE_INCORPORADORA_SLUG ||
    nome === "mirante incorporadora" ||
    slug.includes("mirante")
  );
}

export function isImobClient(client?: ClientIdentity | null) {
  if (!client) return false;
  if (client.perfilPanel === "imob") return true;
  return isSouIcarai(client) || isAcademyAmericana(client) || isMiranteIncorporadora(client);
}
