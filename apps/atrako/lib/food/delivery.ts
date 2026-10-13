/** Frete em linha reta. O valor não vem do navegador e esta função não chama mapa. */

export type LatLng = { lat: number; lng: number };

export type DeliveryBand = {
  minKm: number;
  maxKm: number;
  feeCents: number;
  active: boolean;
};

export type DeliveryRules = {
  lat: number | null;
  lng: number | null;
  maxKm: number | null;
  freeDeliveryEnabled: boolean;
  freeDeliveryMinCents: number;
  bands: DeliveryBand[];
};

export type DeliverySnapshot = {
  available: true;
  mode: "flat" | "distance" | "pickup";
  distanceKm: number | null;
  band: { minKm: number; maxKm: number; feeCents: number } | null;
  originalFeeCents: number;
  discountCents: number;
  feeCents: number;
  method: "linha_reta" | "taxa_fixa" | "retirada";
  rulesVersion: string;
  calculatedAt: string;
  destination: LatLng | null;
};

export type Geocoder = {
  lookup(address: string): Promise<LatLng | null>;
};

/** Porta vazia. Um geocodificador próprio pode entrar aqui sem mudar a conta do frete. */
export const emptyGeocoder: Geocoder = {
  async lookup() {
    return null;
  },
};

const EARTH_KM = 6371;

export function validCoord(lat: number, lng: number) {
  return Number.isFinite(lat) && Number.isFinite(lng) && lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180;
}

export function haversineKm(from: LatLng, to: LatLng) {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLat = ((to.lat - from.lat) * Math.PI) / 180;
  const dLng = ((to.lng - from.lng) * Math.PI) / 180;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_KM * Math.asin(Math.min(1, Math.sqrt(h)));
}

function numberOrNull(value: unknown) {
  const number = typeof value === "number" ? value : Number(value);
  return Number.isFinite(number) ? number : null;
}

export function asDeliveryRules(value: unknown): DeliveryRules {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const bands = Array.isArray(raw.bands) ? raw.bands : [];
  return {
    lat: numberOrNull(raw.lat),
    lng: numberOrNull(raw.lng),
    maxKm: numberOrNull(raw.maxKm),
    freeDeliveryEnabled: raw.freeDeliveryEnabled === true,
    freeDeliveryMinCents: Math.max(0, Math.round(numberOrNull(raw.freeDeliveryMinCents) ?? 0)),
    bands: bands
      .map((row) => {
        const band = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        return {
          minKm: numberOrNull(band.minKm) ?? NaN,
          maxKm: numberOrNull(band.maxKm) ?? NaN,
          feeCents: Math.max(0, Math.round(numberOrNull(band.feeCents) ?? 0)),
          active: band.active !== false,
        };
      })
      .filter((band) => Number.isFinite(band.minKm) && Number.isFinite(band.maxKm)),
  };
}

export function rulesConfigured(rules: DeliveryRules) {
  return rules.lat != null && rules.lng != null && validCoord(rules.lat, rules.lng) && rules.bands.some((band) => band.active);
}

export function rulesVersion(rules: DeliveryRules) {
  const active = rules.bands
    .filter((band) => band.active)
    .map((band) => [band.minKm, band.maxKm, band.feeCents]);
  return JSON.stringify({
    lat: rules.lat,
    lng: rules.lng,
    maxKm: rules.maxKm,
    free: rules.freeDeliveryEnabled,
    freeMin: rules.freeDeliveryMinCents,
    bands: active,
  });
}

/** Faixas ativas, em ordem. O ponto em comum fica na faixa de baixo. A última inclui o máximo. */
export function activeBands(rules: DeliveryRules) {
  return rules.bands.filter((band) => band.active).sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);
}

export function validateBands(bands: DeliveryBand[]): { ok: true } | { ok: false; error: string } {
  const active = bands.filter((band) => band.active).sort((a, b) => a.minKm - b.minKm || a.maxKm - b.maxKm);
  if (!active.length) return { ok: false, error: "Inclua ao menos uma faixa de frete." };
  for (const band of active) {
    if (!(band.maxKm > band.minKm)) return { ok: false, error: "Cada faixa precisa terminar depois de começar." };
    if (band.minKm < 0 || band.feeCents < 0) return { ok: false, error: "Distância e preço não podem ser negativos." };
  }
  for (let index = 1; index < active.length; index += 1) {
    const previous = active[index - 1];
    const current = active[index];
    if (current.minKm < previous.maxKm) return { ok: false, error: "As faixas não podem se sobrepor." };
    if (current.minKm > previous.maxKm) return { ok: false, error: "As faixas não podem deixar um trecho sem preço." };
  }
  return { ok: true };
}

export function matchBand(distanceKm: number, rules: DeliveryRules) {
  const bands = activeBands(rules);
  for (const band of bands) {
    if (distanceKm >= band.minKm && distanceKm <= band.maxKm) return band;
  }
  return null;
}

export function quoteDelivery(input: {
  rules: DeliveryRules;
  fulfillment: "DELIVERY" | "PICKUP";
  deliveryEnabled: boolean;
  flatFeeCents: number;
  subtotalCents: number;
  destination: LatLng | null;
  now?: Date;
}): { ok: true; snapshot: DeliverySnapshot } | { ok: false; error: string } {
  const now = (input.now ?? new Date()).toISOString();
  if (input.fulfillment === "PICKUP") {
    return {
      ok: true,
      snapshot: {
        available: true,
        mode: "pickup",
        distanceKm: null,
        band: null,
        originalFeeCents: 0,
        discountCents: 0,
        feeCents: 0,
        method: "retirada",
        rulesVersion: rulesVersion(input.rules),
        calculatedAt: now,
        destination: null,
      },
    };
  }
  if (!input.deliveryEnabled) return { ok: false, error: "Entrega indisponível." };
  if (!rulesConfigured(input.rules)) {
    return {
      ok: true,
      snapshot: {
        available: true,
        mode: "flat",
        distanceKm: null,
        band: null,
        originalFeeCents: input.flatFeeCents,
        discountCents: 0,
        feeCents: input.flatFeeCents,
        method: "taxa_fixa",
        rulesVersion: "taxa_fixa",
        calculatedAt: now,
        destination: null,
      },
    };
  }
  const origin = { lat: input.rules.lat as number, lng: input.rules.lng as number };
  if (!validCoord(origin.lat, origin.lng)) return { ok: false, error: "O ponto da casa está inválido." };
  const destination = input.destination;
  if (!destination || !validCoord(destination.lat, destination.lng)) {
    return { ok: false, error: "Compartilhe a localização para calcular o frete." };
  }
  const distanceKm = Math.round(haversineKm(origin, destination) * 100) / 100;
  const maxKm = input.rules.maxKm ?? activeBands(input.rules).at(-1)?.maxKm ?? 0;
  if (distanceKm > maxKm) return { ok: false, error: "Esse endereço está fora da área de entrega." };
  const band = matchBand(distanceKm, input.rules);
  if (!band) return { ok: false, error: "Esse endereço está fora da área de entrega." };
  const originalFeeCents = band.feeCents;
  const free = input.rules.freeDeliveryEnabled && input.subtotalCents >= input.rules.freeDeliveryMinCents;
  return {
    ok: true,
    snapshot: {
      available: true,
      mode: "distance",
      distanceKm,
      band: { minKm: band.minKm, maxKm: band.maxKm, feeCents: band.feeCents },
      originalFeeCents,
      discountCents: free ? originalFeeCents : 0,
      feeCents: free ? 0 : originalFeeCents,
      method: "linha_reta",
      rulesVersion: rulesVersion(input.rules),
      calculatedAt: now,
      destination,
    },
  };
}
