import type { Data } from "@puckeditor/core";

export type LpGoal = "leads" | "sales";

export type LpSection =
  | {
      id: string;
      type: "hero";
      headline: string;
      subheadline?: string;
      mediaUrl?: string;
    }
  | {
      id: string;
      type: "benefits";
      items: string[];
    }
  | {
      id: string;
      type: "social_proof";
      quotes: Array<{ text: string; author?: string }>;
    }
  | {
      id: string;
      type: "faq";
      items: Array<{ q: string; a: string }>;
    }
  | {
      id: string;
      type: "form";
      title?: string;
    }
  | {
      id: string;
      type: "checkout";
    }
  | {
      id: string;
      type: "cta";
      label: string;
      href?: string;
    };

export type LpDeliverable = {
  kind: "file" | "url";
  label: string;
  value: string;
};

/** Tipos canônicos de CommerceProduct.type (checkout). */
export const COMMERCE_PRODUCT_TYPES = [
  "FILE",
  "SERVICE",
  "COURSE",
  "PHYSICAL",
  "OTHER",
] as const;

export type CommerceProductType = (typeof COMMERCE_PRODUCT_TYPES)[number];

export const COMMERCE_PRODUCT_TYPE_LABELS: Record<CommerceProductType, string> = {
  FILE: "Arquivo / digital",
  SERVICE: "Serviço",
  COURSE: "Curso",
  PHYSICAL: "Físico",
  OTHER: "Outro",
};

export function isCommerceProductType(v: string): v is CommerceProductType {
  return (COMMERCE_PRODUCT_TYPES as readonly string[]).includes(v);
}

/** LP v1 — seções (legado). */
export type LpSalesPageV1 = {
  goal: LpGoal;
  version: 1;
  sections: LpSection[];
  formId?: string;
  /** CommerceProduct vendido pelo checkout embutido. */
  checkoutProductId?: string;
  deliverable?: LpDeliverable;
};

/** LP v2 — Puck Data. */
export type LpSalesPageV2 = {
  goal: LpGoal;
  version: 2;
  puck: Data;
  formId?: string;
  /** CommerceProduct vendido pelo checkout embutido. */
  checkoutProductId?: string;
  deliverable?: LpDeliverable;
};

export type LpSalesPage = LpSalesPageV1 | LpSalesPageV2;

export function newSectionId() {
  return `s_${Math.random().toString(36).slice(2, 10)}`;
}

export function isLpSalesPageV2(v: unknown): v is LpSalesPageV2 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === 2 &&
    (o.goal === "leads" || o.goal === "sales") &&
    o.puck != null &&
    typeof o.puck === "object"
  );
}

export function isLpSalesPageV1(v: unknown): v is LpSalesPageV1 {
  if (!v || typeof v !== "object") return false;
  const o = v as Record<string, unknown>;
  return (
    o.version === 1 &&
    (o.goal === "leads" || o.goal === "sales") &&
    Array.isArray(o.sections)
  );
}

/** @deprecated use isLpSalesPageV1 */
export function isLpSalesPage(v: unknown): v is LpSalesPageV1 {
  return isLpSalesPageV1(v);
}

/** Compat com LPs antigas (headline/bullets) e v1. Sempre retorna v1 para SalesPageView. */
export function normalizeSalesPage(
  raw: unknown,
  fallbackGoal: LpGoal = "sales",
): LpSalesPageV1 {
  if (isLpSalesPageV1(raw)) return raw;
  if (isLpSalesPageV2(raw)) {
    return {
      goal: raw.goal,
      version: 1,
      sections: [],
      deliverable: raw.deliverable,
      formId: raw.formId,
      checkoutProductId: raw.checkoutProductId,
    };
  }
  const o = (raw && typeof raw === "object" ? raw : {}) as Record<string, unknown>;
  const headline =
    typeof o.headline === "string" && o.headline.trim()
      ? o.headline.trim()
      : "Sua oferta";
  const sub =
    typeof o.subheadline === "string" ? o.subheadline.trim() : undefined;
  const bullets = Array.isArray(o.bullets)
    ? (o.bullets as unknown[]).filter((x): x is string => typeof x === "string")
    : [];
  const cta =
    typeof o.cta === "string" && o.cta.trim() ? o.cta.trim() : "Quero comprar";
  const goal: LpGoal = o.goal === "leads" ? "leads" : fallbackGoal;

  const sections: LpSection[] = [
    {
      id: newSectionId(),
      type: "hero",
      headline,
      subheadline: sub,
    },
  ];
  if (bullets.length) {
    sections.push({ id: newSectionId(), type: "benefits", items: bullets });
  }
  if (goal === "leads") {
    sections.push({
      id: newSectionId(),
      type: "form",
      title: "Deixe seus dados",
    });
  } else {
    sections.push({ id: newSectionId(), type: "checkout" });
    sections.push({ id: newSectionId(), type: "cta", label: cta });
  }
  return { goal, version: 1, sections };
}
