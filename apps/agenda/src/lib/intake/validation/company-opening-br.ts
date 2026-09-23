import { z } from "zod";
import type { CompanyOpeningBrData } from "@/lib/intake/types";

const cpfDigits = z
  .string()
  .transform((s) => s.replace(/\D/g, ""))
  .refine((s) => s.length === 11, "CPF inválido");

const partnerSchema = z.object({
  fullName: z.string().min(3, "Informe o nome completo"),
  cpf: cpfDigits,
  rgOrCnh: z.string().min(3, "Informe RG ou CNH"),
  birthDate: z.string().min(8, "Informe a data de nascimento"),
  nationality: z.string().min(2, "Informe a nacionalidade"),
  maritalStatus: z.enum([
    "single",
    "married",
    "divorced",
    "widowed",
    "stable_union",
  ]),
  marriageRegime: z.string().optional(),
  profession: z.string().min(2, "Informe a profissão"),
  address: z.string().min(5, "Informe o endereço"),
  zipCode: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length === 8, "CEP inválido"),
  email: z.string().email("E-mail inválido"),
  phone: z
    .string()
    .transform((s) => s.replace(/\D/g, ""))
    .refine((s) => s.length >= 10, "Telefone inválido"),
  cpfOnIdDoc: z.boolean(),
});

export const companyOpeningBrSchema = z
  .object({
    partners: z.array(partnerSchema).min(1, "Adicione ao menos um sócio"),
    companyNameOptions: z.tuple([
      z.string().min(2, "Informe a 1ª opção de nome"),
      z.string().min(2, "Informe a 2ª opção de nome"),
      z.string().min(2, "Informe a 3ª opção de nome"),
    ]),
    tradeName: z.string().min(2, "Informe o nome fantasia"),
    preferredLegalName: z.string().min(2, "Informe a razão social preferida"),
    shareCapitalReais: z
      .string()
      .min(1, "Informe o capital social")
      .refine((v) => {
        const n = parseFloat(v.replace(/\./g, "").replace(",", "."));
        return !Number.isNaN(n) && n > 0;
      }, "Capital inválido"),
    ownership: z.array(
      z.object({
        partnerIndex: z.number().int().min(0),
        percentage: z.number().min(0).max(100),
      }),
    ),
    administration: z.object({
      administratorPartnerIndices: z
        .array(z.number().int().min(0))
        .min(1, "Selecione quem administra"),
      mode: z.enum(["sole", "joint"]),
    }),
    activities: z.string().min(10, "Descreva as atividades da empresa"),
    headquarters: z.object({
      address: z.string().min(5, "Informe o endereço da sede"),
      zipCode: z
        .string()
        .transform((s) => s.replace(/\D/g, ""))
        .refine((s) => s.length === 8, "CEP inválido"),
      isRented: z.boolean(),
    }),
  })
  .superRefine((data, ctx) => {
    const sum = data.ownership.reduce((acc, o) => acc + o.percentage, 0);
    if (Math.abs(sum - 100) > 0.01) {
      ctx.addIssue({
        code: "custom",
        message: "A soma das participações deve ser 100%",
        path: ["ownership"],
      });
    }
    for (const p of data.partners) {
      if (
        (p.maritalStatus === "married" || p.maritalStatus === "stable_union") &&
        !p.marriageRegime?.trim()
      ) {
        ctx.addIssue({
          code: "custom",
          message: "Informe o regime de casamento",
          path: ["partners"],
        });
      }
    }
  });

export type CompanyOpeningBrInput = z.infer<typeof companyOpeningBrSchema>;

const stepSchemas: Record<string, z.ZodTypeAny> = {
  partners: z.object({ partners: companyOpeningBrSchema.shape.partners }),
  company: z.object({
    companyNameOptions: companyOpeningBrSchema.shape.companyNameOptions,
    tradeName: companyOpeningBrSchema.shape.tradeName,
    preferredLegalName: companyOpeningBrSchema.shape.preferredLegalName,
  }),
  capital: z.object({
    shareCapitalReais: companyOpeningBrSchema.shape.shareCapitalReais,
  }),
  ownership: z.object({
    ownership: companyOpeningBrSchema.shape.ownership,
  }),
  administration: z.object({
    administration: companyOpeningBrSchema.shape.administration,
  }),
  activities: z.object({
    activities: companyOpeningBrSchema.shape.activities,
  }),
  headquarters: z.object({
    headquarters: companyOpeningBrSchema.shape.headquarters,
  }),
};

export function validateIntakeStep(
  stepId: string,
  data: Partial<CompanyOpeningBrData>,
): { ok: true } | { ok: false; message: string } {
  const schema = stepSchemas[stepId];
  if (!schema) return { ok: true };
  const result = schema.safeParse(data);
  if (result.success) return { ok: true };
  const msg = result.error.issues[0]?.message || "Dados inválidos";
  return { ok: false, message: msg };
}

export function validateFullIntakeData(
  data: unknown,
): { ok: true; data: CompanyOpeningBrData } | { ok: false; message: string } {
  const result = companyOpeningBrSchema.safeParse(data);
  if (!result.success) {
    return {
      ok: false,
      message: result.error.issues[0]?.message || "Dados inválidos",
    };
  }
  return { ok: true, data: result.data as CompanyOpeningBrData };
}

export function parseIntakeData(raw: string): CompanyOpeningBrData | null {
  try {
    return JSON.parse(raw) as CompanyOpeningBrData;
  } catch {
    return null;
  }
}

export function primaryContactFromData(data: CompanyOpeningBrData) {
  const p = data.partners[0];
  return {
    customerName: p?.fullName || "",
    customerEmail: p?.email || "",
    customerPhone: p?.phone || "",
    customerCpf: p?.cpf || "",
  };
}
