/**
 * Specs dos CaptureForms Regicenter (ids = fieldKeys).
 */

import type { FormStep } from "@atrako/forms";
import { labelsFor } from "./choices";

export const REGICENTER_LP_FORM = {
  name: "Franquia Regicenter — LP",
  slug: "franquia-regicenter-lp",
  source: "franquia",
  steps: [
    {
      id: "lp",
      title: "Cadastro",
      fields: [
        { id: "name", type: "text" as const, label: "Seu nome", required: true },
        { id: "phone", type: "phone" as const, label: "WhatsApp", required: true },
        { id: "email", type: "email" as const, label: "E-mail", required: true },
        { id: "city", type: "text" as const, label: "Cidade", required: true },
        {
          id: "best_contact_time",
          type: "choice" as const,
          label: "Melhor horário para contato",
          required: false,
          options: labelsFor("best_contact_time"),
        },
        {
          id: "wa_opt_in",
          type: "consent" as const,
          label: "Autorizo contato da Regicenter por WhatsApp e e-mail sobre a franquia",
          required: true,
        },
      ],
    },
  ] satisfies FormStep[],
};

export const REGICENTER_QUALIFY_FORM = {
  name: "Franquia Regicenter — Qualificação",
  slug: "franquia-regicenter-qualify",
  source: "franquia",
  steps: [
    { id: "s_name", title: "Nome", fields: [{ id: "name", type: "text" as const, label: "Qual é o seu nome?", required: true }] },
    { id: "s_phone", title: "WhatsApp", fields: [{ id: "phone", type: "phone" as const, label: "Qual seu WhatsApp?", required: true }] },
    { id: "s_email", title: "E-mail", fields: [{ id: "email", type: "email" as const, label: "Qual seu e-mail?", required: true }] },
    { id: "s_city", title: "Cidade", fields: [{ id: "city", type: "text" as const, label: "Em qual cidade você está?", required: true }] },
    {
      id: "s_niche",
      title: "Área",
      fields: [
        {
          id: "niche",
          type: "choice" as const,
          label: "Em qual área você atua hoje?",
          required: true,
          options: labelsFor("niche"),
        },
      ],
    },
    {
      id: "s_timeline",
      title: "Prazo",
      fields: [
        {
          id: "start_timeline",
          type: "choice" as const,
          label: "Se fizer sentido, quando gostaria de começar?",
          required: true,
          options: labelsFor("start_timeline"),
        },
      ],
    },
    {
      id: "s_objective",
      title: "Objetivo",
      fields: [
        {
          id: "business_objective",
          type: "choice" as const,
          label: "Qual seu principal objetivo com a franquia?",
          required: true,
          options: labelsFor("business_objective"),
        },
      ],
    },
    {
      id: "s_question",
      title: "Dúvida",
      fields: [
        {
          id: "main_question",
          type: "choice" as const,
          label: "O que você mais precisa entender agora?",
          required: true,
          options: labelsFor("main_question"),
        },
      ],
    },
    {
      id: "s_investment",
      title: "Investimento",
      fields: [
        {
          id: "investment_status",
          type: "choice" as const,
          label: "Por último: sobre o investimento inicial da franquia, qual é o seu momento?",
          required: true,
          options: labelsFor("investment_status"),
        },
      ],
    },
    {
      id: "s_consent",
      title: "Consentimento",
      fields: [
        {
          id: "wa_opt_in",
          type: "consent" as const,
          label: "Autorizo contato da Regicenter por WhatsApp e e-mail sobre a franquia",
          required: true,
        },
      ],
    },
  ] satisfies FormStep[],
};
