import { z } from "zod";

export type BookBody = {
  serviceId: string;
  startAt: string;
  timezone: string;
  professionalId?: string;
  customerName: string;
  customerEmail?: string;
  customerPhone?: string;
  customerCpf?: string;
  customAnswers?: Record<string, string>;
};

export const bookBodySchema = z.object({
  serviceId: z.string().min(1),
  startAt: z.string().datetime(),
  timezone: z.string().min(1),
  professionalId: z.string().optional(),
  customerName: z.string().min(2),
  customerEmail: z.string().email().optional().or(z.literal("")),
  customerPhone: z.string().min(8).optional().or(z.literal("")),
  customerCpf: z.string().optional(),
  customAnswers: z.record(z.string(), z.string()).optional(),
});

export function parseBookBody(raw: unknown): BookBody {
  return bookBodySchema.parse(raw) as BookBody;
}
