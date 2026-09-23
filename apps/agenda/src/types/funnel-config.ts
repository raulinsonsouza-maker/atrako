import { z } from "zod";

export const formFieldTypes = [
  "text",
  "email",
  "phone",
  "cpf",
  "textarea",
  "select",
] as const;

export type FormFieldType = (typeof formFieldTypes)[number];

export type FormFieldConfig = {
  id: string;
  preset?: string;
  label: string;
  type: FormFieldType;
  required: boolean;
  enabled: boolean;
  options?: string[];
  sortOrder: number;
};

export type FunnelBlock =
  | { id: string; type: "text"; content: string; align?: "left" | "center" }
  | { id: string; type: "image"; url: string; alt?: string }
  | { id: string; type: "divider" }
  | { id: string; type: "testimonial"; quote: string; author: string };

export type FunnelTheme = {
  accentColor: string;
  logoUrl?: string;
  heroTitle?: string;
  heroSubtitle?: string;
  background?: "white" | "muted";
};

export type FunnelConfig = {
  theme: FunnelTheme;
  blocks: FunnelBlock[];
  formFields: FormFieldConfig[];
};

export const FIELD_PRESETS: Omit<FormFieldConfig, "id" | "sortOrder">[] = [
  {
    preset: "customerName",
    label: "Nome completo",
    type: "text",
    required: true,
    enabled: true,
  },
  {
    preset: "customerEmail",
    label: "E-mail",
    type: "email",
    required: true,
    enabled: true,
  },
  {
    preset: "customerPhone",
    label: "Celular",
    type: "phone",
    required: true,
    enabled: true,
  },
  {
    preset: "customerCpf",
    label: "CPF",
    type: "cpf",
    required: false,
    enabled: false,
  },
  {
    preset: "message",
    label: "Conte brevemente sua situação",
    type: "textarea",
    required: false,
    enabled: false,
  },
  {
    preset: "company",
    label: "Empresa",
    type: "text",
    required: false,
    enabled: false,
  },
  {
    preset: "referral",
    label: "Como nos conheceu?",
    type: "select",
    required: false,
    enabled: false,
    options: ["Google", "Instagram", "Indicação", "Outro"],
  },
];

const formFieldSchema = z.object({
  id: z.string(),
  preset: z.string().optional(),
  label: z.string().min(1),
  type: z.enum(formFieldTypes),
  required: z.boolean(),
  enabled: z.boolean(),
  options: z.array(z.string()).optional(),
  sortOrder: z.number(),
});

const blockSchema = z.discriminatedUnion("type", [
  z.object({
    id: z.string(),
    type: z.literal("text"),
    content: z.string(),
    align: z.enum(["left", "center"]).optional(),
  }),
  z.object({
    id: z.string(),
    type: z.literal("image"),
    url: z.string(),
    alt: z.string().optional(),
  }),
  z.object({ id: z.string(), type: z.literal("divider") }),
  z.object({
    id: z.string(),
    type: z.literal("testimonial"),
    quote: z.string(),
    author: z.string(),
  }),
]);

export const funnelConfigSchema = z.object({
  theme: z.object({
    accentColor: z.string(),
    logoUrl: z.string().optional(),
    heroTitle: z.string().optional(),
    heroSubtitle: z.string().optional(),
    background: z.enum(["white", "muted"]).optional(),
  }),
  blocks: z.array(blockSchema),
  formFields: z.array(formFieldSchema),
});
