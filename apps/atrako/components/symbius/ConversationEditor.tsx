"use client";

import { ChevronDown, ChevronUp, Trash2 } from "lucide-react";
import { IconButton } from "@/components/ui";
import { PillSelect } from "@/components/ui/pill-select";
import {
  STEP_TYPE_LABEL,
  emptyStep,
  nextStepId,
  stepOptionLabel,
  type Conversation,
  type ConversationStep,
} from "@/lib/instagram/conversation";
import { wizardInputCls, wizardTextareaCls } from "./wizard-ui";

const TYPES: ConversationStep["type"][] = ["message", "phone", "email", "link", "handoff"];

export function ConversationEditor({
  value,
  onChange,
  onFocusStep,
}: {
  value: Conversation;
  onChange: (next: Conversation) => void;
  onFocusStep: (stepId: string) => void;
}) {
  function patch(index: number, step: ConversationStep) {
    onChange({ steps: value.steps.map((item, i) => (i === index ? step : item)) });
  }

  function move(index: number, delta: number) {
    const target = index + delta;
    if (target < 0 || target >= value.steps.length) return;
    const steps = value.steps.slice();
    const [item] = steps.splice(index, 1);
    steps.splice(target, 0, item);
    onChange({ steps });
  }

  function remove(index: number) {
    const id = value.steps[index]?.id;
    const steps = value.steps
      .filter((_, i) => i !== index)
      .map((step) => {
        if ((step.type === "phone" || step.type === "email" || step.type === "link") && step.goTo === id) {
          return { ...step, goTo: null };
        }
        if (step.type === "message") {
          return { ...step, buttons: step.buttons.filter((button) => button.goTo !== id) };
        }
        return step;
      });
    onChange({ steps });
  }

  function destinations(stepId: string, allowEnd: boolean) {
    const options = value.steps
      .map((step, index) => ({ step, index }))
      .filter(({ step }) => step.id !== stepId)
      .map(({ step, index }) => ({ value: step.id, label: stepOptionLabel(step, index) }));
    return allowEnd ? [{ value: "", label: "Encerrar" }, ...options] : options;
  }

  return (
    <div className="space-y-3">
      <p className="type-body-strong text-[var(--ink)]">A conversa</p>
      {value.steps.map((step, index) => (
        <div key={step.id} className="space-y-2 rounded-[var(--radius-lg)] border border-[var(--hairline)] p-3">
          <div className="flex items-center gap-2">
            <div className="min-w-0 flex-1">
              <PillSelect
                size="field"
                aria-label={`Tipo do passo ${index + 1}`}
                value={step.type}
                onChange={(type) => patch(index, emptyStep(type as ConversationStep["type"], step.id))}
                options={TYPES.map((type) => ({ value: type, label: STEP_TYPE_LABEL[type] }))}
              />
            </div>
            <IconButton size="toolbar" aria-label={`Subir passo ${index + 1}`} onClick={() => move(index, -1)}>
              <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
            <IconButton size="toolbar" aria-label={`Descer passo ${index + 1}`} onClick={() => move(index, 1)}>
              <ChevronDown className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
            <IconButton size="toolbar" className="text-[var(--danger)]" aria-label={`Excluir passo ${index + 1}`} onClick={() => remove(index)}>
              <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
            </IconButton>
          </div>

          <textarea
            value={step.text}
            onChange={(e) => patch(index, { ...step, text: e.target.value.slice(0, 1000) })}
            className={wizardTextareaCls}
            placeholder={step.type === "phone" || step.type === "email" ? "Pergunta" : "Mensagem"}
          />

          {step.type === "message"
            ? step.buttons.map((button, buttonIndex) => (
                <div key={`${step.id}-${buttonIndex}`} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      value={button.label}
                      onChange={(e) => {
                        const buttons = step.buttons.map((item, i) =>
                          i === buttonIndex ? { ...item, label: e.target.value.slice(0, 20) } : item,
                        );
                        patch(index, { ...step, buttons });
                      }}
                      className={wizardInputCls}
                      placeholder="Texto do botão"
                    />
                    <IconButton
                      size="toolbar"
                      className="text-[var(--danger)]"
                      aria-label={`Excluir botão ${buttonIndex + 1}`}
                      onClick={() => patch(index, { ...step, buttons: step.buttons.filter((_, i) => i !== buttonIndex) })}
                    >
                      <Trash2 className="h-3.5 w-3.5" strokeWidth={1.75} />
                    </IconButton>
                  </div>
                  <PillSelect
                    size="field"
                    aria-label={`Destino do botão ${buttonIndex + 1}`}
                    value={button.goTo}
                    onChange={(goTo) => {
                      const buttons = step.buttons.map((item, i) => (i === buttonIndex ? { ...item, goTo } : item));
                      patch(index, { ...step, buttons });
                      if (goTo) onFocusStep(goTo);
                    }}
                    options={[{ value: "", label: "Próximo passo" }, ...destinations(step.id, false)]}
                  />
                </div>
              ))
            : null}

          {step.type === "message" && step.buttons.length < 3 ? (
            <button
              type="button"
              className="type-caption text-[var(--primary)]"
              onClick={() => patch(index, { ...step, buttons: [...step.buttons, { label: "", goTo: "" }] })}
            >
              + Adicionar botão
            </button>
          ) : null}

          {step.type === "link" ? (
            <>
              <input
                value={step.label}
                onChange={(e) => patch(index, { ...step, label: e.target.value.slice(0, 20) })}
                className={wizardInputCls}
                placeholder="Texto do botão"
              />
              <input
                value={step.url}
                onChange={(e) => patch(index, { ...step, url: e.target.value })}
                className={wizardInputCls}
                placeholder="https://"
                inputMode="url"
              />
              <textarea
                value={step.thanks}
                onChange={(e) => patch(index, { ...step, thanks: e.target.value.slice(0, 1000) })}
                className={wizardTextareaCls}
                placeholder="Mensagem depois que a pessoa abre o link"
              />
            </>
          ) : null}

          {step.type === "phone" || step.type === "email" || step.type === "link" ? (
            <PillSelect
              size="field"
              aria-label={`Depois do passo ${index + 1}`}
              value={step.goTo ?? ""}
              onChange={(goTo) => {
                patch(index, { ...step, goTo: goTo || null });
                if (goTo) onFocusStep(goTo);
              }}
              options={destinations(step.id, true)}
            />
          ) : null}
        </div>
      ))}
      <PillSelect
        size="field"
        aria-label="Adicionar passo"
        value=""
        onChange={(type) => {
          if (!type) return;
          const id = nextStepId(value.steps);
          onChange({ steps: [...value.steps, emptyStep(type as ConversationStep["type"], id)] });
        }}
        options={[{ value: "", label: "Adicionar passo" }, ...TYPES.map((type) => ({ value: type, label: STEP_TYPE_LABEL[type] }))]}
      />
      <p className="type-fine-print text-[var(--ink-muted-48)]">Até 3 botões por mensagem. O texto de cada um tem no máximo 20 caracteres.</p>
    </div>
  );
}
