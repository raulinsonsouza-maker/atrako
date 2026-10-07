/** Campanha em 3 passos: Planejar → Criar → Agendar (status do banco continuam os mesmos). */
export type CampaignStage = "planejar" | "criar" | "agendar" | "enviada" | "cancelada";

export const STAGES = [
  { key: "planejar", label: "Planejar" },
  { key: "criar", label: "Criar" },
  { key: "agendar", label: "Agendar" },
] as const;

export type StepKey = (typeof STAGES)[number]["key"];

export function campaignStage(status: string): CampaignStage {
  if (status === "IDEIA" || status === "BRIEFING") return "planejar";
  if (status === "CRIACAO" || status === "REVISAO" || status === "APROVADA") return "criar";
  if (status === "AGENDADA" || status === "ENVIANDO") return "agendar";
  if (status === "ENVIADA") return "enviada";
  return "cancelada";
}

export const STAGE_LABEL: Record<string, string> = {
  IDEIA: "Planejando",
  BRIEFING: "Planejando",
  CRIACAO: "Criando",
  REVISAO: "Criando",
  APROVADA: "Criando",
  AGENDADA: "Agendada",
  ENVIANDO: "Enviando",
  ENVIADA: "Enviada",
  PERDIDA: "Cancelada",
};

export function statusTone(status: string): "ok" | "warn" | "bad" | undefined {
  if (status === "ENVIADA" || status === "AGENDADA") return "ok";
  if (status === "PERDIDA") return "bad";
  if (status === "ENVIANDO") return "warn";
  return undefined;
}
