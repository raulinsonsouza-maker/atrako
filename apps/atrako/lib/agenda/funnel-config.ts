export type FormFieldConfig = {
  id: string;
  label: string;
  preset?: "customerName" | "customerEmail" | "customerPhone" | "customerCpf";
  enabled?: boolean;
  required?: boolean;
  sortOrder?: number;
};

export type FunnelConfig = {
  theme?: {
    accentColor?: string;
    logoUrl?: string;
    heroTitle?: string;
    heroSubtitle?: string;
    background?: string;
  };
  blocks?: unknown[];
  formFields?: FormFieldConfig[];
};

const FIELD_PRESETS: FormFieldConfig[] = [
  { id: "customerName", label: "Nome", preset: "customerName", enabled: true, required: true, sortOrder: 0 },
  { id: "customerEmail", label: "E-mail", preset: "customerEmail", enabled: true, required: true, sortOrder: 1 },
  { id: "customerPhone", label: "WhatsApp", preset: "customerPhone", enabled: true, required: true, sortOrder: 2 },
];

export function defaultFormFields(): FormFieldConfig[] {
  return FIELD_PRESETS.map((p) => ({ ...p }));
}

export function buildDefaultFunnelConfig(page: {
  title: string;
  description?: string | null;
  accentColor?: string | null;
  logoUrl?: string | null;
}): FunnelConfig {
  return {
    theme: {
      accentColor: page.accentColor || "#0066cc",
      logoUrl: page.logoUrl || undefined,
      heroTitle: page.title,
      heroSubtitle: page.description || undefined,
      background: "white",
    },
    blocks: [],
    formFields: defaultFormFields(),
  };
}

export function parseFunnelConfig(raw: unknown): FunnelConfig | null {
  if (!raw) return null;
  try {
    if (typeof raw === "string") return JSON.parse(raw) as FunnelConfig;
    return raw as FunnelConfig;
  } catch {
    return null;
  }
}

export function enabledFormFields(config: FunnelConfig | null): FormFieldConfig[] {
  const fields = config?.formFields?.length ? config.formFields : defaultFormFields();
  return fields
    .filter((f) => f.enabled !== false)
    .sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));
}

export function mergeFunnelConfig(
  config: FunnelConfig | null,
  page: {
    title: string;
    description?: string | null;
    accentColor?: string | null;
    logoUrl?: string | null;
  },
): FunnelConfig {
  const base = config ?? buildDefaultFunnelConfig(page);
  return {
    ...base,
    theme: {
      ...base.theme,
      accentColor: page.accentColor || base.theme?.accentColor || "#0066cc",
      logoUrl: page.logoUrl || base.theme?.logoUrl,
      heroTitle: base.theme?.heroTitle || page.title,
      heroSubtitle: base.theme?.heroSubtitle ?? page.description ?? undefined,
    },
  };
}

export function serializeFunnelConfig(config: FunnelConfig) {
  return config;
}
