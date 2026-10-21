"use client";

import { Loader2 } from "lucide-react";
import { Button, OptionChip } from "@/components/ui";
import type { QualifyFieldKey } from "@/lib/qualification/fields";
import { enabledQuestions, type PriorityRule } from "@/lib/qualification/script";
import type { Jornada } from "./useJornada";
import type { ScriptDraft } from "./useScriptDraft";

const COLUMNS = [
  { key: "A" as const, title: "A · quente", tone: "ok", what: "Pede o melhor horário e vai para a equipe com aviso urgente e e-mail." },
  { key: "B" as const, title: "B · interessado", tone: "warn", what: "Pede o melhor horário e vai para a equipe." },
];

export function RulesEditor({ data, s, canManage }: { data: Jornada; s: ScriptDraft; canManage: boolean }) {
  const { draft } = s;
  const questions = enabledQuestions(draft).filter((q) => q.options.length);
  const message = s.messageFor("rules");

  function toggle(col: "A" | "B", key: QualifyFieldKey, code: string) {
    const rule: PriorityRule = { ...draft.rules[col] };
    const cur = rule[key] ?? [];
    const next = cur.includes(code) ? cur.filter((c) => c !== code) : [...cur, code];
    if (next.length) rule[key] = next;
    else delete rule[key];
    s.setDraft({ ...draft, rules: { ...draft.rules, [col]: rule } });
  }

  return (
    <div className="flex flex-col gap-4">
      <p className="type-caption text-[var(--ink-muted-80)]">
        Ao terminar as perguntas, o lead vira A se bater todas as condições de A; senão B se bater as de B; senão C. Pergunta sem nada
        marcado aceita qualquer resposta.
      </p>
      <div className="script-rules">
        {COLUMNS.map((col) => (
          <section key={col.key} className="script-rule-col">
            <header className="flex items-baseline justify-between gap-2">
              <span className="flex items-center gap-2">
                <span className="script-dot" data-tone={col.tone} aria-hidden />
                <span className="type-body-strong text-[var(--ink)]">{col.title}</span>
              </span>
              <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{data.priorities[col.key]} leads abertos</span>
            </header>
            <span className="type-fine-print text-[var(--ink-muted-80)]">{col.what}</span>
            {questions.map((q) => {
              const picked = draft.rules[col.key][q.key] ?? [];
              return (
                <div key={q.key} className="flex flex-col gap-1.5">
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    {q.label}
                    {picked.length ? "" : " · qualquer resposta"}
                  </span>
                  <div className="flex flex-wrap gap-1.5">
                    {q.options.map((o) => {
                      const n = data.answerCounts[q.key]?.[o.code] ?? 0;
                      return (
                        <OptionChip
                          key={o.code}
                          selected={picked.includes(o.code)}
                          disabled={!canManage}
                          onClick={() => toggle(col.key, q.key, o.code)}
                          className="px-3 py-1.5"
                        >
                          {o.label}
                          {n ? <span className="tabular-nums text-[var(--ink-muted-48)]">{n}</span> : null}
                        </OptionChip>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </section>
        ))}
        <section className="script-rule-col">
          <header className="flex items-baseline justify-between gap-2">
            <span className="flex items-center gap-2">
              <span className="script-dot" aria-hidden />
              <span className="type-body-strong text-[var(--ink)]">C · nutrição</span>
            </span>
            <span className="type-fine-print tabular-nums text-[var(--ink-muted-48)]">{data.priorities.C} leads abertos</span>
          </header>
          <span className="type-fine-print text-[var(--ink-muted-80)]">
            Todo o resto. Recebe a mensagem de nutrição e segue nos e-mails; pode pedir conversa a qualquer momento.
          </span>
        </section>
      </div>
      {canManage ? (
        <div className="flex flex-wrap items-center gap-2">
          <Button size="toolbar" disabled={!s.dirty("rules") || s.saving} onClick={() => void s.save("rules")}>
            {s.saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Salvar classificação
          </Button>
          {s.customized("rules") ? (
            <Button size="toolbar" variant="ghost" disabled={s.saving} onClick={() => void s.reset("rules")}>
              Restaurar padrão
            </Button>
          ) : null}
          {message ? (
            <span className={`type-fine-print ${message.tone === "bad" ? "text-[var(--danger)]" : "text-[var(--ink-muted-80)]"}`}>
              {message.text}
            </span>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
