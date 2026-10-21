"use client";

import { useEffect, useState } from "react";
import type { QualifyFieldKey } from "@/lib/qualification/fields";
import type { FollowUpId, QualifyScript, ScriptBlockId } from "@/lib/qualification/script";
import type { Jornada, SaveResult } from "./useJornada";

type Post = { mutateAsync: (body: Record<string, unknown>) => Promise<SaveResult>; isPending: boolean };

const TEMPLATE_BLOCKS = new Set<ScriptBlockId>(["opening", "followUp:nudge"]);

function sliceOf(script: QualifyScript, block: ScriptBlockId): unknown {
  if (block.startsWith("question:")) return script.questions.find((q) => q.key === block.slice(9));
  if (block.startsWith("followUp:")) return script.followUps.find((f) => f.id === block.slice(9));
  if (block === "questions") return { order: script.questions.map((q) => q.key), showProgress: script.showProgress };
  return script[block as "opening" | "bestTime" | "handoff" | "nurture" | "rules"];
}

/** O que vai para a API ao salvar o bloco. */
function patchOf(script: QualifyScript, block: ScriptBlockId): Record<string, unknown> {
  if (block.startsWith("question:")) {
    const q = script.questions.find((x) => x.key === block.slice(9))!;
    return { text: q.text, enabled: q.enabled, ...(q.options.length ? { options: q.options.filter((o) => o.label.trim()) } : {}) };
  }
  if (block.startsWith("followUp:")) {
    const f = script.followUps.find((x) => x.id === block.slice(9))!;
    return { afterHours: f.afterHours, text: f.text, enabled: f.enabled };
  }
  if (block === "questions") return { questionOrder: script.questions.map((q) => q.key), showProgress: script.showProgress };
  return { ...(script[block as "opening" | "bestTime" | "handoff" | "nurture"] as object) };
}

export function useScriptDraft(data: Jornada, post: Post) {
  const [draft, setDraft] = useState<QualifyScript>(data.script);
  const [open, setOpen] = useState<ScriptBlockId | null>(null);
  const [message, setMessage] = useState<{ block: ScriptBlockId; text: string; tone?: "ok" | "bad" } | null>(null);
  const savedKey = JSON.stringify(data.script);

  useEffect(() => {
    setDraft(JSON.parse(savedKey) as QualifyScript);
  }, [savedKey]);

  const dirty = (block: ScriptBlockId) => JSON.stringify(sliceOf(draft, block)) !== JSON.stringify(sliceOf(data.script, block));

  function toggle(block: ScriptBlockId) {
    setDraft(data.script);
    setMessage(null);
    setOpen((cur) => (cur === block ? null : block));
  }

  function select(block: ScriptBlockId) {
    if (open === block) return;
    setDraft(data.script);
    setMessage(null);
    setOpen(block);
  }

  async function run(block: ScriptBlockId, body: Record<string, unknown>, okText?: string) {
    try {
      const res = await post.mutateAsync(body);
      const t = res.template;
      if (t?.error) setMessage({ block, text: `Salvo. A Meta recusou a nova versão: ${t.error}`, tone: "bad" });
      else if (t?.synced) setMessage({ block, text: "Salvo. Nova versão enviada para a Meta; a atual segue valendo até a aprovação." });
      else if (TEMPLATE_BLOCKS.has(block) && t?.reason === "whatsapp_not_connected")
        setMessage({ block, text: "Salvo. Vai para aprovação da Meta quando o WhatsApp for conectado." });
      else setMessage({ block, text: okText ?? "Salvo", tone: "ok" });
    } catch (e) {
      setMessage({ block, text: e instanceof Error ? e.message : "Não foi possível salvar", tone: "bad" });
    }
  }

  const save = (block: ScriptBlockId) => run(block, { action: "save_block", block, patch: patchOf(draft, block) });

  const reset = (block: ScriptBlockId) => run(block, { action: "reset_block", block }, "Padrão restaurado");

  /** Mudança que salva na hora (liga/desliga, ordem). */
  function saveNow(block: ScriptBlockId, next: QualifyScript, patch: Record<string, unknown>) {
    setDraft(next);
    void run(block, { action: "save_block", block, patch });
  }

  function setQuestion(key: QualifyFieldKey, patch: Partial<QualifyScript["questions"][number]>) {
    setDraft((d) => ({ ...d, questions: d.questions.map((q) => (q.key === key ? { ...q, ...patch } : q)) }));
  }

  function setFollowUp(id: FollowUpId, patch: Partial<QualifyScript["followUps"][number]>) {
    setDraft((d) => ({ ...d, followUps: d.followUps.map((f) => (f.id === id ? { ...f, ...patch } : f)) }));
  }

  const customized = (block: ScriptBlockId) => data.customized.includes(block);
  const messageFor = (block: ScriptBlockId) => (message?.block === block ? message : null);

  return {
    draft,
    setDraft,
    open,
    toggle,
    select,
    dirty,
    save,
    reset,
    saveNow,
    setQuestion,
    setFollowUp,
    customized,
    messageFor,
    saving: post.isPending,
  };
}

export type ScriptDraft = ReturnType<typeof useScriptDraft>;
