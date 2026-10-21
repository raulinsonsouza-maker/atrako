"use client";

import { BellRing, RotateCcw, UsersRound } from "lucide-react";
import { PillSelect, Switch } from "@/components/ui";
import { FOLLOW_UP_DELAYS, FOLLOW_UP_LABEL, followUpPreview, renderText, type FollowUpId } from "@/lib/qualification/script";
import { ScriptBlock, ScriptText } from "./ScriptBlock";
import { ScriptPhone } from "./ScriptPhone";
import { TEMPLATE_STATE_LABEL, type Jornada } from "./useJornada";
import type { ScriptDraft } from "./useScriptDraft";

const ICON = { reask: RotateCcw, nudge: BellRing, team: UsersRound } as const;

export function delayLabel(hours: number) {
  if (hours < 24) return `${hours} h`;
  const days = Math.round(hours / 24);
  return `${days} dia${days > 1 ? "s" : ""}`;
}

const HINT: Record<FollowUpId, string> = {
  reask: "Vai antes da pergunta que ficou sem resposta. Só sai enquanto a conversa está aberta (24 h).",
  nudge: "Se a conversa já fechou, vai como modelo da Meta com os botões Continuar e Falar com consultor. Quem tem e-mail recebe um lembrete por e-mail também.",
  team: "",
};

export function FollowUpEditor({ data, s, canManage }: { data: Jornada; s: ScriptDraft; canManage: boolean }) {
  const { draft, open } = s;
  const brand = data.brand || "sua empresa";
  const nudgeTpl = TEMPLATE_STATE_LABEL[data.templates["followUp:nudge"]];

  return (
    <div className="script-grid">
      <div className="script-list">
        <div className="script-group-head">
          <span className="type-fine-print text-[var(--ink-muted-48)]">
            Quando o lead para de responder no meio. Responder a qualquer momento retoma de onde parou.
          </span>
        </div>
        {draft.followUps.map((f) => {
          const block = `followUp:${f.id}` as const;
          return (
            <ScriptBlock
              key={f.id}
              icon={ICON[f.id]}
              title={`${delayLabel(f.afterHours)} sem resposta · ${FOLLOW_UP_LABEL[f.id].title}`}
              summary={f.id === "team" ? "Aviso no sino para um toque manual" : renderText(f.text, { nome: "Maria", empresa: brand })}
              off={!f.enabled}
              open={open === block}
              onToggle={() => s.toggle(block)}
              customized={s.customized(block)}
              dirty={s.dirty(block)}
              saving={s.saving}
              onSave={canManage ? () => void s.save(block) : undefined}
              onReset={canManage ? () => void s.reset(block) : undefined}
              message={s.messageFor(block)}
              aside={
                <Switch
                  checked={f.enabled}
                  disabled={!canManage || s.saving}
                  onChange={(on) =>
                    s.saveNow(block, { ...draft, followUps: draft.followUps.map((x) => (x.id === f.id ? { ...x, enabled: on } : x)) }, { enabled: on })
                  }
                  aria-label={FOLLOW_UP_LABEL[f.id].title}
                />
              }
              status={
                f.id === "nudge" && data.channels.whatsapp.connected ? (
                  <span className="rel-badge type-micro-legal self-start" data-tone={nudgeTpl.tone}>
                    {nudgeTpl.label}
                  </span>
                ) : null
              }
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Depois de</span>
                <PillSelect
                  value={String(f.afterHours)}
                  onChange={(v) => s.setFollowUp(f.id, { afterHours: Number(v) })}
                  options={FOLLOW_UP_DELAYS[f.id].map((h) => ({ value: String(h), label: delayLabel(h) }))}
                  aria-label="Prazo"
                />
                <span className="type-fine-print text-[var(--ink-muted-48)]">sem resposta</span>
              </div>
              {f.id !== "team" ? (
                <ScriptText
                  value={f.text}
                  onChange={(text) => s.setFollowUp(f.id, { text })}
                  vars={f.id === "nudge" ? ["nome", "empresa"] : ["nome"]}
                  hint={HINT[f.id]}
                />
              ) : (
                <span className="type-fine-print text-[var(--ink-muted-48)]">
                  A equipe recebe um aviso para chamar o lead. A automação para por aqui.
                </span>
              )}
            </ScriptBlock>
          );
        })}
      </div>

      <ScriptPhone brand={brand} items={followUpPreview(draft, brand, data.lpKeys)} active={open} onSelect={s.select} />
    </div>
  );
}
