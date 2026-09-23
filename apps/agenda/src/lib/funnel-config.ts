import {
  FIELD_PRESETS,
  type FunnelConfig,
  type FormFieldConfig,
  funnelConfigSchema,
} from "@/types/funnel-config";

export function defaultFormFields(): FormFieldConfig[] {
  return FIELD_PRESETS.map((p, i) => ({
    ...p,
    id: p.preset || `field_${i}`,
    sortOrder: i,
  }));
}

export function buildDefaultFunnelConfig(page: {
  title: string;
  description?: string | null;
  accentColor: string;
  logoUrl?: string | null;
}): FunnelConfig {
  return {
    theme: {
      accentColor: page.accentColor || "#0a0a0a",
      logoUrl: page.logoUrl || undefined,
      heroTitle: page.title,
      heroSubtitle: page.description || undefined,
      background: "white",
    },
    blocks: [],
    formFields: defaultFormFields(),
  };
}

export function parseFunnelConfig(raw: string | null | undefined): FunnelConfig | null {
  if (!raw) return null;
  try {
    const parsed = funnelConfigSchema.parse(JSON.parse(raw));
    return parsed;
  } catch {
    return null;
  }
}

export function mergeFunnelConfig(
  existing: FunnelConfig | null,
  page: {
    title: string;
    description?: string | null;
    accentColor: string;
    logoUrl?: string | null;
  },
): FunnelConfig {
  const base = existing || buildDefaultFunnelConfig(page);
  return {
    theme: {
      ...base.theme,
      accentColor: base.theme.accentColor || page.accentColor,
      logoUrl: base.theme.logoUrl ?? page.logoUrl ?? undefined,
      heroTitle: base.theme.heroTitle ?? page.title,
      heroSubtitle: base.theme.heroSubtitle ?? page.description ?? undefined,
    },
    blocks: base.blocks,
    formFields: base.formFields.length ? base.formFields : defaultFormFields(),
  };
}

export function enabledFormFields(config: FunnelConfig | null): FormFieldConfig[] {
  if (!config) return defaultFormFields().filter((f) => f.enabled);
  return [...config.formFields]
    .filter((f) => f.enabled)
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function presetToBookingKey(preset?: string): string | null {
  if (!preset) return null;
  if (
    preset === "customerName" ||
    preset === "customerEmail" ||
    preset === "customerPhone" ||
    preset === "customerCpf"
  ) {
    return preset;
  }
  return null;
}

export function serializeFunnelConfig(config: FunnelConfig): string {
  return JSON.stringify(config);
}
