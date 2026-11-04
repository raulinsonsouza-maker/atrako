/**
 * Spec do CaptureForm da LP Vilaris (mentoria de carreira).
 */

import type { FormStep } from "@atrako/forms";

export const VILARIS_MOMENT_OPTIONS = [
  "Quero mudar de área ou setor",
  "Estou buscando uma recolocação",
  "Quero crescer mais rápido na empresa atual",
  "Quero chegar a uma posição de liderança",
  "Ainda não tenho clareza sobre meu próximo passo",
] as const;

export const VILARIS_LP_FORM = {
  name: "Vilaris — Mentoria de Carreira",
  slug: "vilaris-lp",
  source: "lp",
  steps: [
    {
      id: "lead",
      title: "Conversa",
      fields: [
        { id: "name", type: "text" as const, label: "Nome completo", required: true },
        { id: "phone", type: "phone" as const, label: "WhatsApp", required: true },
        { id: "email", type: "email" as const, label: "E-mail", required: true },
        { id: "role", type: "text" as const, label: "Cargo atual", required: true },
        { id: "area", type: "text" as const, label: "Área de atuação", required: true },
        {
          id: "moment",
          type: "choice" as const,
          label: "O que melhor representa seu momento?",
          required: true,
          options: [...VILARIS_MOMENT_OPTIONS],
        },
        {
          id: "challenge",
          type: "text" as const,
          label: "Qual é o principal desafio da sua carreira?",
          required: true,
        },
      ],
    },
  ] satisfies FormStep[],
};
