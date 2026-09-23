import { prisma } from "@/lib/db";
import { fireOutboundWebhook } from "./integrations";

export type ConversionTipo =
  | "follow_confirmed"
  | "email_captured"
  | "link_clicked"
  | "phone_captured"
  | "fluxo_started"
  | "fluxo_completed"
  | "handoff";

export async function recordConversion(params: {
  organizationId: string;
  tipo: ConversionTipo;
  contatoId?: string;
  fluxoId?: string;
  metadata?: Record<string, unknown>;
}): Promise<void> {
  await prisma.igConversionEvent.create({
    data: {
      organizationId: params.organizationId,
      contatoId: params.contatoId,
      fluxoId: params.fluxoId,
      tipo: params.tipo,
      metadata: (params.metadata ?? {}) as object,
    },
  });

  void fireOutboundWebhook(params.organizationId, `conversion.${params.tipo}`, {
    contatoId: params.contatoId,
    fluxoId: params.fluxoId,
    ...params.metadata,
  });
}
