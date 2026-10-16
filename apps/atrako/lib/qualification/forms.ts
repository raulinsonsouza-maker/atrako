/**
 * Specs dos CaptureForms Regicenter (ids = fieldKeys).
 * LP = 1 passo com vários campos (form padrão para anúncio).
 * Qualify = um campo por passo (typeform / passo a passo).
 */

import type { FormStep } from "@atrako/forms";
import { labelsFor, REGICENTER_FRANCHISE_INVESTMENT } from "./choices";

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
        { id: "state", type: "state" as const, label: "Estado", required: true },
        { id: "city", type: "city" as const, label: "Cidade", required: true, dependsOn: "state" },
        {
          id: "best_contact_time",
          type: "choice" as const,
          label: "Melhor horário para contato",
          required: false,
          options: labelsFor("best_contact_time"),
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
    { id: "s_state", title: "Estado", fields: [{ id: "state", type: "state" as const, label: "Em qual estado você está?", required: true }] },
    {
      id: "s_city",
      title: "Cidade",
      fields: [{ id: "city", type: "city" as const, label: "Em qual cidade você está?", required: true, dependsOn: "state" }],
    },
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
          label: `Por último: o investimento inicial da franquia é ${REGICENTER_FRANCHISE_INVESTMENT}. Qual é o seu momento?`,
          required: true,
          options: labelsFor("investment_status"),
        },
      ],
    },
  ] satisfies FormStep[],
};
