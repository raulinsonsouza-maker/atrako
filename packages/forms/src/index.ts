import { createEvent, publishEventBatch } from "@atrako/events";

export type FormFieldType = "text" | "email" | "phone" | "choice" | "number";

export interface FormField {
  id: string;
  type: FormFieldType;
  label: string;
  required?: boolean;
  options?: string[];
}

export interface FormBranch {
  whenFieldId: string;
  equals: string;
  nextStepId: string;
}

export interface FormStep {
  id: string;
  title: string;
  fields: FormField[];
  branches?: FormBranch[];
  nextStepId?: string;
}

export interface ConditionalForm {
  id: string;
  workspaceId: string;
  name: string;
  steps: FormStep[];
  status: "DRAFT" | "PUBLISHED";
}

export interface FormAnswer {
  fieldId: string;
  value: string;
}

export function createFormFromBrief(input: {
  workspaceId: string;
  brief: string;
}): ConditionalForm {
  const id = `form_${Date.now().toString(36)}`;
  return {
    id,
    workspaceId: input.workspaceId,
    name: input.brief.slice(0, 80),
    status: "DRAFT",
    steps: [
      {
        id: "step_1",
        title: "Qualificação",
        fields: [
          { id: "name", type: "text", label: "Nome", required: true },
          { id: "email", type: "email", label: "E-mail", required: true },
          {
            id: "ready",
            type: "choice",
            label: "Sua empresa está pronta para investir em tráfego?",
            required: true,
            options: ["Sim", "Ainda não", "Quero saber mais"],
          },
        ],
        branches: [
          { whenFieldId: "ready", equals: "Sim", nextStepId: "step_offer" },
          { whenFieldId: "ready", equals: "Ainda não", nextStepId: "step_nurture" },
        ],
        nextStepId: "step_offer",
      },
      {
        id: "step_offer",
        title: "Oferta",
        fields: [
          { id: "phone", type: "phone", label: "WhatsApp", required: true },
        ],
      },
      {
        id: "step_nurture",
        title: "Nutrição",
        fields: [
          {
            id: "interest",
            type: "text",
            label: "O que você gostaria de aprender primeiro?",
            required: true,
          },
        ],
      },
    ],
  };
}

export function resolveNextStep(form: ConditionalForm, stepId: string, answers: FormAnswer[]): string | null {
  const step = form.steps.find((item) => item.id === stepId);
  if (!step) return null;
  for (const branch of step.branches ?? []) {
    const answer = answers.find((item) => item.fieldId === branch.whenFieldId);
    if (answer && answer.value === branch.equals) return branch.nextStepId;
  }
  return step.nextStepId ?? null;
}

export function previewForm(form: ConditionalForm) {
  return {
    id: form.id,
    name: form.name,
    status: form.status,
    stepCount: form.steps.length,
    steps: form.steps.map((step) => ({
      id: step.id,
      title: step.title,
      fieldLabels: step.fields.map((field) => field.label),
      branches: step.branches ?? [],
    })),
  };
}

export async function publishFormCompletion(input: {
  workspaceId: string;
  formId: string;
  leadId?: string;
  contactId?: string;
  answers: FormAnswer[];
}) {
  const flat: Record<string, string> = {};
  for (const a of input.answers) flat[a.fieldId] = a.value;

  const formEvent = createEvent({
    name: "form.completed",
    source: "atrako",
    idempotencyKey: `form-completed-${input.formId}-${input.leadId ?? input.contactId ?? Date.now()}`,
    context: {
      workspaceId: input.workspaceId,
      formId: input.formId,
      leadId: input.leadId,
      contactId: input.contactId,
    },
    payload: { answers: input.answers, ...flat },
  });

  const leadEvent = createEvent({
    name: "lead.created",
    source: "atrako",
    idempotencyKey: `form-lead-${input.formId}-${input.leadId ?? input.contactId ?? flat.email ?? Date.now()}`,
    context: {
      workspaceId: input.workspaceId,
      formId: input.formId,
      leadId: input.leadId,
      contactId: input.contactId,
    },
    payload: {
      nome: flat.name || flat.nome,
      email: flat.email,
      telefone: flat.phone || flat.whatsapp || flat.telefone,
      fonte: "form",
      formId: input.formId,
      answers: input.answers,
    },
  });

  return publishEventBatch([formEvent, leadEvent]);
}
