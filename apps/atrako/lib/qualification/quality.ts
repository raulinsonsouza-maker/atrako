/**
 * Qualidade dos leads do período: distribuição das respostas coletadas
 * (LP, formulário passo a passo e WhatsApp), prioridade e preenchimento.
 */

import { prisma } from "@/lib/db";
import { CHOICE_MAP, resolveChoice } from "@/lib/qualification/choices";
import { FIELD_DEFS, filledPercent, type QualifyFieldKey } from "@/lib/qualification/fields";
import { parseLeadQualification } from "@/lib/qualification/store";

export type QualityBucket = { key: string; label: string; count: number };

export type LeadQualityField = {
  key: QualifyFieldKey;
  label: string;
  answered: number;
  buckets: QualityBucket[];
};

export type LeadQuality = {
  totals: {
    leads: number;
    withAnswers: number;
    classified: number;
    complete: number;
    avgFilled: number;
  };
  priority: { A: number; B: number; C: number; none: number };
  fields: LeadQualityField[];
  states: QualityBucket[];
  cities: QualityBucket[];
  origins: QualityBucket[];
  answerChannels: QualityBucket[];
};

const CHOICE_FIELDS: QualifyFieldKey[] = [
  "investment_status",
  "start_timeline",
  "business_objective",
  "niche",
  "main_question",
  "best_contact_time",
];

const CHANNEL_LABEL: Record<string, string> = {
  lp: "Landing page",
  typeform: "Formulário passo a passo",
  form: "Formulário",
  whatsapp: "WhatsApp",
  email: "E-mail",
  manual: "Equipe",
};

const MAX_LEADS = 5000;
const TOP = 6;

function originLabel(source: string | null, metadata: Record<string, unknown>) {
  const utm = typeof metadata.utm_source === "string" ? metadata.utm_source.trim() : "";
  if (utm) return utm.toLowerCase();
  const s = (source || "").toLowerCase();
  if (s.endsWith("-lp")) return "Landing page";
  if (s.endsWith("-qualify")) return "Formulário passo a passo";
  if (s === "meta_lead") return "Formulário do Meta";
  if (s.includes("whatsapp")) return "WhatsApp";
  return source?.trim() || "Sem origem";
}

function bump(map: Map<string, QualityBucket>, key: string, label: string) {
  const hit = map.get(key);
  if (hit) hit.count += 1;
  else map.set(key, { key, label, count: 1 });
}

function sorted(map: Map<string, QualityBucket>, limit?: number) {
  const list = [...map.values()].sort((a, b) => b.count - a.count);
  if (!limit || list.length <= limit) return list;
  const rest = list.slice(limit).reduce((sum, b) => sum + b.count, 0);
  return [...list.slice(0, limit), { key: "_rest", label: "Outros", count: rest }];
}

export async function getLeadQuality(
  workspaceId: string,
  range: { gte: Date; lte: Date },
): Promise<LeadQuality> {
  const leads = await prisma.nativeLead.findMany({
    where: { clienteId: workspaceId, createdAt: { gte: range.gte, lte: range.lte } },
    select: { metadata: true, source: true },
    orderBy: { createdAt: "desc" },
    take: MAX_LEADS,
  });

  const totals = { leads: leads.length, withAnswers: 0, classified: 0, complete: 0, avgFilled: 0 };
  const priority = { A: 0, B: 0, C: 0, none: 0 };
  const fieldMaps = new Map<QualifyFieldKey, Map<string, QualityBucket>>(
    CHOICE_FIELDS.map((key) => [
      key,
      new Map((CHOICE_MAP[key] ?? []).map((o) => [o.code, { key: o.code, label: o.label, count: 0 }])),
    ]),
  );
  const answeredByField = new Map<QualifyFieldKey, number>();
  const states = new Map<string, QualityBucket>();
  const cities = new Map<string, QualityBucket>();
  const origins = new Map<string, QualityBucket>();
  const channels = new Map<string, QualityBucket>();
  let filledSum = 0;

  for (const lead of leads) {
    const metadata =
      lead.metadata && typeof lead.metadata === "object" && !Array.isArray(lead.metadata)
        ? (lead.metadata as Record<string, unknown>)
        : {};
    const q = parseLeadQualification(lead.metadata);
    const origin = originLabel(lead.source, metadata);
    bump(origins, origin.toLowerCase(), origin);

    const answers = q.answers;
    const keys = Object.keys(answers) as QualifyFieldKey[];
    const scoring = keys.filter((k) => CHOICE_FIELDS.includes(k) || k === "city");
    if (scoring.length) totals.withAnswers += 1;

    if (q.priority === "A" || q.priority === "B" || q.priority === "C") {
      priority[q.priority] += 1;
      totals.classified += 1;
    } else {
      priority.none += 1;
    }

    const filled = filledPercent(answers);
    filledSum += filled;
    if (filled === 100) totals.complete += 1;

    for (const key of CHOICE_FIELDS) {
      const answer = answers[key];
      const raw = answer?.code || answer?.value || "";
      if (!raw.trim()) continue;
      answeredByField.set(key, (answeredByField.get(key) ?? 0) + 1);
      const choice = resolveChoice(key, raw);
      bump(fieldMaps.get(key)!, choice.code, choice.label === raw ? answer?.label || raw : choice.label);
    }

    const state = answers.state?.value?.trim().toUpperCase();
    if (state) bump(states, state, state);
    const city = answers.city?.value?.trim();
    if (city) bump(cities, city.toLowerCase(), state ? `${city} · ${state}` : city);

    for (const key of keys) {
      const src = answers[key]?.source;
      if (!src || key === "wa_opt_in") continue;
      bump(channels, src, CHANNEL_LABEL[src] ?? src);
    }
  }

  totals.avgFilled = leads.length ? Math.round(filledSum / leads.length) : 0;

  const labelOf = (key: QualifyFieldKey) => FIELD_DEFS.find((d) => d.key === key)?.crmLabel ?? key;

  return {
    totals,
    priority,
    fields: CHOICE_FIELDS.map((key) => ({
      key,
      label: labelOf(key),
      answered: answeredByField.get(key) ?? 0,
      buckets: [...fieldMaps.get(key)!.values()],
    })),
    states: sorted(states, TOP),
    cities: sorted(cities, TOP),
    origins: sorted(origins, TOP),
    answerChannels: sorted(channels),
  };
}
