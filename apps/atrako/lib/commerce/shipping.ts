/** Frete por tabela fixa de faixas de CEP. Sem Correios / geocoding. */

export type ShippingZone = {
  id: string;
  name: string;
  cepFrom: string;
  cepTo: string;
  feeCents: number;
  daysMin: number;
  daysMax: number;
  active: boolean;
};

export type ShippingRules = {
  pickupEnabled: boolean;
  shipEnabled: boolean;
  freeShippingMinCents: number | null;
  zones: ShippingZone[];
  defaultFeeCents: number | null;
  defaultDaysMin: number | null;
  defaultDaysMax: number | null;
};

export type ShippingSnapshot =
  | {
      available: true;
      mode: "ship" | "pickup";
      zoneId: string | null;
      zoneName: string | null;
      cep: string | null;
      originalFeeCents: number;
      discountCents: number;
      feeCents: number;
      daysMin: number | null;
      daysMax: number | null;
      freeShippingApplied: boolean;
      calculatedAt: string;
    }
  | {
      available: false;
      mode: "ship" | "pickup";
      reason: string;
      cep: string | null;
      calculatedAt: string;
    };

function numberOrNull(value: unknown) {
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

export function onlyCepDigits(value: string) {
  return value.replace(/\D/g, "").slice(0, 8);
}

export function normalizeCep(value: string): string | null {
  const d = onlyCepDigits(value);
  return d.length === 8 ? d : null;
}

export function asShippingRules(value: unknown): ShippingRules {
  const raw = value && typeof value === "object" && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const zones = Array.isArray(raw.zones) ? raw.zones : [];
  return {
    pickupEnabled: raw.pickupEnabled !== false,
    shipEnabled: raw.shipEnabled !== false,
    freeShippingMinCents: (() => {
      const n = numberOrNull(raw.freeShippingMinCents);
      return n != null && n > 0 ? Math.round(n) : null;
    })(),
    defaultFeeCents: (() => {
      const n = numberOrNull(raw.defaultFeeCents);
      return n != null && n >= 0 ? Math.round(n) : null;
    })(),
    defaultDaysMin: numberOrNull(raw.defaultDaysMin),
    defaultDaysMax: numberOrNull(raw.defaultDaysMax),
    zones: zones
      .map((row, index) => {
        const z = row && typeof row === "object" ? (row as Record<string, unknown>) : {};
        const cepFrom = onlyCepDigits(String(z.cepFrom ?? ""));
        const cepTo = onlyCepDigits(String(z.cepTo ?? ""));
        return {
          id: typeof z.id === "string" && z.id ? z.id : `zone-${index}`,
          name: typeof z.name === "string" && z.name.trim() ? z.name.trim().slice(0, 80) : `Zona ${index + 1}`,
          cepFrom: cepFrom.padStart(8, "0").slice(0, 8),
          cepTo: cepTo.padStart(8, "0").slice(0, 8),
          feeCents: Math.max(0, Math.round(numberOrNull(z.feeCents) ?? 0)),
          daysMin: Math.max(0, Math.round(numberOrNull(z.daysMin) ?? 0)),
          daysMax: Math.max(0, Math.round(numberOrNull(z.daysMax) ?? 0)),
          active: z.active !== false,
        };
      })
      .filter((z) => z.cepFrom.length === 8 && z.cepTo.length === 8 && z.cepFrom <= z.cepTo),
  };
}

export function findShippingZone(rules: ShippingRules, cep: string): ShippingZone | null {
  const normalized = normalizeCep(cep);
  if (!normalized) return null;
  for (const zone of rules.zones) {
    if (!zone.active) continue;
    if (normalized >= zone.cepFrom && normalized <= zone.cepTo) return zone;
  }
  return null;
}

export function quoteShipping(input: {
  rules: ShippingRules;
  fulfillment: "SHIP" | "PICKUP";
  cep?: string | null;
  subtotalCents: number;
  now?: Date;
}): ShippingSnapshot {
  const calculatedAt = (input.now ?? new Date()).toISOString();
  const cep = input.cep ? normalizeCep(input.cep) : null;

  if (input.fulfillment === "PICKUP") {
    if (!input.rules.pickupEnabled) {
      return { available: false, mode: "pickup", reason: "Retirada indisponível", cep, calculatedAt };
    }
    return {
      available: true,
      mode: "pickup",
      zoneId: null,
      zoneName: null,
      cep,
      originalFeeCents: 0,
      discountCents: 0,
      feeCents: 0,
      daysMin: null,
      daysMax: null,
      freeShippingApplied: false,
      calculatedAt,
    };
  }

  if (!input.rules.shipEnabled) {
    return { available: false, mode: "ship", reason: "Entrega indisponível", cep, calculatedAt };
  }
  if (!cep) {
    return { available: false, mode: "ship", reason: "CEP inválido", cep: null, calculatedAt };
  }

  const zone = findShippingZone(input.rules, cep);
  let originalFeeCents: number;
  let daysMin: number | null;
  let daysMax: number | null;
  let zoneId: string | null = null;
  let zoneName: string | null = null;

  if (zone) {
    originalFeeCents = zone.feeCents;
    daysMin = zone.daysMin;
    daysMax = Math.max(zone.daysMin, zone.daysMax);
    zoneId = zone.id;
    zoneName = zone.name;
  } else if (input.rules.defaultFeeCents != null) {
    originalFeeCents = input.rules.defaultFeeCents;
    daysMin = input.rules.defaultDaysMin;
    daysMax =
      input.rules.defaultDaysMax != null && input.rules.defaultDaysMin != null
        ? Math.max(input.rules.defaultDaysMin, input.rules.defaultDaysMax)
        : input.rules.defaultDaysMax;
  } else {
    return {
      available: false,
      mode: "ship",
      reason: "CEP fora das áreas de entrega",
      cep,
      calculatedAt,
    };
  }

  const freeMin = input.rules.freeShippingMinCents;
  const freeShippingApplied = freeMin != null && input.subtotalCents >= freeMin;
  const feeCents = freeShippingApplied ? 0 : originalFeeCents;
  const discountCents = originalFeeCents - feeCents;

  return {
    available: true,
    mode: "ship",
    zoneId,
    zoneName,
    cep,
    originalFeeCents,
    discountCents,
    feeCents,
    daysMin,
    daysMax,
    freeShippingApplied,
    calculatedAt,
  };
}

export function defaultShippingRules(): ShippingRules {
  return {
    pickupEnabled: true,
    shipEnabled: true,
    freeShippingMinCents: null,
    zones: [],
    defaultFeeCents: 1500,
    defaultDaysMin: 5,
    defaultDaysMax: 10,
  };
}
