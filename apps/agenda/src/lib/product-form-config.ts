import {
  defaultFormFields,
  enabledFormFields,
  parseFunnelConfig,
} from "@/lib/funnel-config";
import type { FormFieldConfig, FunnelConfig } from "@/types/funnel-config";

export type ProductFormConfig = {
  formFields: FormFieldConfig[];
};

export function defaultProductFormConfig(): ProductFormConfig {
  return { formFields: defaultFormFields() };
}

export function parseProductFormConfig(raw: string | null | undefined): ProductFormConfig {
  if (!raw) return defaultProductFormConfig();
  try {
    const parsed = JSON.parse(raw) as ProductFormConfig;
    if (parsed?.formFields?.length) return parsed;
  } catch {
    /* fallback */
  }
  const funnel = parseFunnelConfig(raw);
  if (funnel?.formFields?.length) {
    return { formFields: funnel.formFields };
  }
  return defaultProductFormConfig();
}

export function enabledProductFormFields(config: ProductFormConfig | null) {
  return enabledFormFields(
    config ? ({ formFields: config.formFields } as FunnelConfig) : null,
  );
}

export function serializeProductFormConfig(config: ProductFormConfig) {
  return JSON.stringify(config);
}
