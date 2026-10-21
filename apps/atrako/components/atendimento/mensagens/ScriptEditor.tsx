"use client";

import { Fragment, useMemo } from "react";
import { ArrowDown, ArrowUp, CalendarClock, ClipboardList, ListChecks, MessageCircle, Sprout, UserRoundCheck } from "lucide-react";
import { Button, Switch } from "@/components/ui";
import { leadBrief } from "@/lib/qualification/journey";
import type { QualifyAnswers, QualifyFieldKey } from "@/lib/qualification/fields";
import {
  enabledQuestions,
  nurturePreview,
  renderText,
  scriptConversation,
  type QualifyScript,
  type ScriptBlockId,
} from "@/lib/qualification/script";
import { OptionsEditor, ScriptBlock, ScriptText } from "./ScriptBlock";
import { ScriptPhone } from "./ScriptPhone";
import { TEMPLATE_STATE_LABEL, type Jornada } from "./useJornada";
import type { ScriptDraft } from "./useScriptDraft";

const SAMPLE = { nome: "Maria Souza", cidade: "Curitiba" };

function firstLine(text: string, brand: string) {
  return renderText(text, { ...SAMPLE, empresa: brand }).split("\n")[0] ?? "";
}

function exampleAnswers(script: QualifyScript): QualifyAnswers {
  const out: QualifyAnswers = {};
  const at = "";
  out.city = { value: "Curitiba", label: "Curitiba", source: "whatsapp", at };
  out.state = { value: "PR", label: "PR", source: "form", at };
  for (const q of enabledQuestions(script)) {
    const opt = q.options[0];
    if (opt) out[q.key] = { value: opt.label, label: opt.label, code: opt.code, source: "whatsapp", at };
  }
  out.best_contact_time = { value: "Manhã", label: "Manhã", code: "MORNING", source: "whatsapp", at };
  return out;
}

function GroupHead({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="script-group-head">
      <span className="type-fine-print text-[var(--ink-muted-48)]">{title}</span>
      {children}
    </div>
  );
}

export function ScriptEditor({ data, s, canManage }: { data: Jornada; s: ScriptDraft; canManage: boolean }) {
  const { draft, open } = s;
  const brand = data.brand || "sua empresa";
  const active = enabledQuestions(draft).filter((q) => !data.lpKeys.includes(q.key));

  const items = useMemo(() => {
    const lpKeys = open?.startsWith("question:") ? data.lpKeys.filter((k) => `question:${k}` !== open) : data.lpKeys;
    const base = scriptConversation(draft, { brand, lpKeys });
    if (open !== "nurture") return base;
    const cut = base.findIndex((i) => i.block === "rules");
    return [...base.slice(0, cut < 0 ? base.length : cut), ...nurturePreview(draft, brand)];
  }, [draft, brand, data.lpKeys, open]);

  const brief = useMemo(() => {
    const [, ...rows] = leadBrief({ answers: exampleAnswers(draft), priority: "A", reason: "qualified" }).split("\n");
    return rows.map((line) => line.split(/:\s(.+)/).slice(0, 2) as [string, string]);
  }, [draft]);

  const common = (block: ScriptBlockId) => ({
    open: open === block,
    onToggle: () => s.toggle(block),
    customized: s.customized(block),
    dirty: s.dirty(block),
    saving: s.saving,
    onSave: canManage ? () => void s.save(block) : undefined,
    onReset: canManage ? () => void s.reset(block) : undefined,
    message: s.messageFor(block),
  });

  const visible = draft.questions.filter((q) => !data.lpKeys.includes(q.key));
  const optionalInForm = new Set(data.form.fields.filter((f) => !f.required).map((f) => f.key));

  function move(key: QualifyFieldKey, dir: -1 | 1) {
    const keys = visible.map((q) => q.key);
    const i = keys.indexOf(key);
    const j = i + dir;
    if (j < 0 || j >= keys.length) return;
    [keys[i], keys[j]] = [keys[j]!, keys[i]!];
    const order = [...keys, ...data.lpKeys.filter((k) => draft.questions.some((q) => q.key === k))];
    const next = { ...draft, questions: order.map((k) => draft.questions.find((q) => q.key === k)!) };
    s.saveNow("questions", next, { questionOrder: order });
  }

  const openingTpl = TEMPLATE_STATE_LABEL[data.templates.opening];

  return (
    <div className="script-grid">
      <div className="script-list">
        <section className="script-signup">
          <span className="script-block-icon">
            <ClipboardList className="h-3.5 w-3.5" strokeWidth={1.75} />
          </span>
          <span className="min-w-0">
            <span className="type-caption-strong block text-[var(--ink)]">Cadastro na LP</span>
            <span className="type-fine-print block text-[var(--ink-muted-48)]">
              O que o lead já respondeu aqui não é perguntado de novo no WhatsApp.
            </span>
            <span className="mt-1.5 flex flex-wrap gap-1">
              {data.form.fields.map((f) => (
                <span key={f.key} className="script-chip type-micro-legal" data-optional={!f.required || undefined}>
                  {f.label}
                  {f.required ? "" : " · opcional"}
                </span>
              ))}
            </span>
          </span>
        </section>

        <GroupHead title="Primeiro contato" />
        <ScriptBlock
          icon={MessageCircle}
          title="Abertura"
          summary={firstLine(draft.opening.text, brand)}
          chips={["Começar", "Falar com consultor"]}
          {...common("opening")}
          status={
            data.channels.whatsapp.connected ? (
              <span className="rel-badge type-micro-legal self-start" data-tone={openingTpl.tone}>
                {openingTpl.label}
              </span>
            ) : null
          }
        >
          <ScriptText
            value={draft.opening.text}
            onChange={(text) => s.setDraft({ ...draft, opening: { text } })}
            vars={["nome", "empresa"]}
            hint="Quando o lead não falou com você nas últimas 24 h, vai como modelo da Meta. Ao salvar, a nova versão vai para aprovação e a atual segue valendo."
          />
        </ScriptBlock>

        <GroupHead title={`Perguntas · ${active.length} no WhatsApp`}>
          <label className="flex items-center gap-2 type-fine-print text-[var(--ink-muted-80)]">
            Mostrar progresso (1 de {Math.max(active.length, 1)})
            <Switch
              checked={draft.showProgress}
              disabled={!canManage || s.saving}
              onChange={(on) => s.saveNow("questions", { ...draft, showProgress: on }, { showProgress: on })}
              aria-label="Mostrar progresso nas perguntas"
            />
          </label>
        </GroupHead>
        {visible.map((q, i) => {
          const block = `question:${q.key}` as const;
          return (
            <Fragment key={q.key}>
              <ScriptBlock
                icon={ListChecks}
                title={q.label}
                summary={optionalInForm.has(q.key) ? `Só se não veio no cadastro · ${q.text}` : q.text}
                chips={q.options.map((o) => o.label)}
                off={!q.enabled}
                aside={
                  <Switch
                    checked={q.enabled}
                    disabled={!canManage || s.saving}
                    onChange={(on) =>
                      s.saveNow(block, { ...draft, questions: draft.questions.map((x) => (x.key === q.key ? { ...x, enabled: on } : x)) }, { enabled: on })
                    }
                    aria-label={`Perguntar ${q.label}`}
                  />
                }
                {...common(block)}
              >
                <ScriptText value={q.text} onChange={(text) => s.setQuestion(q.key, { text })} vars={["nome", "cidade"]} label="Pergunta" rows={2} />
                {q.options.length ? (
                  <OptionsEditor value={q.options} onChange={(options) => s.setQuestion(q.key, { options })} />
                ) : (
                  <span className="type-fine-print text-[var(--ink-muted-48)]">Resposta livre, digitada pelo lead.</span>
                )}
                {canManage ? (
                  <div className="flex items-center gap-1">
                    <span className="mr-1 type-fine-print text-[var(--ink-muted-48)]">Ordem</span>
                    <Button size="toolbar" variant="ghost" disabled={i === 0 || s.saving} onClick={() => move(q.key, -1)} aria-label="Subir">
                      <ArrowUp className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      size="toolbar"
                      variant="ghost"
                      disabled={i === visible.length - 1 || s.saving}
                      onClick={() => move(q.key, 1)}
                      aria-label="Descer"
                    >
                      <ArrowDown className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                ) : null}
              </ScriptBlock>
            </Fragment>
          );
        })}

        <GroupHead title="Depois das perguntas" />
        <ScriptBlock
          icon={CalendarClock}
          title="Melhor horário"
          summary={`${optionalInForm.has("best_contact_time") ? "Só se não veio no cadastro · " : ""}${firstLine(draft.bestTime.text, brand)}`}
          chips={["Manhã", "Tarde", "Noite"]}
          off={!draft.bestTime.enabled}
          aside={
            <Switch
              checked={draft.bestTime.enabled}
              disabled={!canManage || s.saving}
              onChange={(on) => s.saveNow("bestTime", { ...draft, bestTime: { ...draft.bestTime, enabled: on } }, { enabled: on })}
              aria-label="Perguntar o melhor horário"
            />
          }
          {...common("bestTime")}
        >
          <ScriptText
            value={draft.bestTime.text}
            onChange={(text) => s.setDraft({ ...draft, bestTime: { ...draft.bestTime, text } })}
            vars={["nome", "empresa"]}
            hint="Só para quem tem perfil para a equipe, e só se o horário não veio no cadastro."
          />
        </ScriptBlock>

        <ScriptBlock icon={UserRoundCheck} title="Passagem para a equipe" summary={firstLine(draft.handoff.text, brand)} {...common("handoff")}>
          <ScriptText
            value={draft.handoff.text}
            onChange={(text) => s.setDraft({ ...draft, handoff: { text } })}
            vars={["nome", "empresa", "horario"]}
            hint="{horario} vira “pela manhã”, “à tarde” ou “à noite”."
          />
          <div className="script-brief-card">
            <span className="type-fine-print text-[var(--ink-muted-48)]">Ficha que o consultor recebe · nota no lead + aviso no sino</span>
            <dl className="script-brief type-caption">
              <dt>Prioridade</dt>
              <dd>A · quente</dd>
              {brief.map(([k, v]) => (
                <Fragment key={k}>
                  <dt>{k}</dt>
                  <dd>{v}</dd>
                </Fragment>
              ))}
            </dl>
          </div>
        </ScriptBlock>

        <ScriptBlock
          icon={Sprout}
          title="Nutrição (C)"
          summary={firstLine(draft.nurture.text, brand)}
          chips={[draft.nurture.buttonLabel]}
          {...common("nurture")}
        >
          <ScriptText
            value={draft.nurture.text}
            onChange={(text) => s.setDraft({ ...draft, nurture: { ...draft.nurture, text } })}
            vars={["nome", "empresa"]}
          />
          <label className="flex flex-col gap-2">
            <span className="type-fine-print text-[var(--ink-muted-48)]">Botão</span>
            <input
              className="rel-input type-caption"
              value={draft.nurture.buttonLabel}
              maxLength={20}
              onChange={(e) => s.setDraft({ ...draft, nurture: { ...draft.nurture, buttonLabel: e.target.value } })}
            />
          </label>
        </ScriptBlock>
      </div>

      <ScriptPhone brand={brand} items={items} active={open} onSelect={s.select} />
    </div>
  );
}
