"use client";

import { useState, useEffect } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import { listLeads } from "@/server/actions/lead";
import { getPipelineWithStages } from "@/server/actions/pipeline";
import { listTags } from "@/server/actions/tag";
import { LeadCard } from "./LeadCard";
import { Button } from "@/design/components";
import { Plus } from "lucide-react";
import type { LeadSource } from "@prisma/client";

const SOURCE_LABELS: Record<LeadSource, string> = {
  META: "Meta",
  GOOGLE: "Google",
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual",
  OUTROS: "Outros",
};

export function LeadsList({ tenantId }: { tenantId: string }) {
  const searchParams = useSearchParams();
  const [leads, setLeads] = useState<Awaited<ReturnType<typeof listLeads>>>([]);
  const [stages, setStages] = useState<{ id: string; name: string }[]>([]);
  const [tags, setTags] = useState<{ id: string; name: string; color: string }[]>([]);
  const [loading, setLoading] = useState(true);
  const [stageId, setStageId] = useState(searchParams.get("stageId") ?? "");
  const [source, setSource] = useState(searchParams.get("source") ?? "");
  const [tagId, setTagId] = useState(searchParams.get("tagId") ?? "");
  const [q, setQ] = useState(searchParams.get("q") ?? "");

  useEffect(() => {
    Promise.all([
      getPipelineWithStages(tenantId).then((p) => {
        if (p?.stages) setStages(p.stages);
      }),
      listTags(tenantId).then(setTags),
    ]);
  }, [tenantId]);

  useEffect(() => {
    setLoading(true);
    listLeads(tenantId, {
      stageId: stageId || undefined,
      source: (source as LeadSource) || undefined,
      tagId: tagId || undefined,
      q: q || undefined,
    })
      .then(setLeads)
      .finally(() => setLoading(false));
  }, [tenantId, stageId, source, tagId, q]);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={stageId}
            onChange={(e) => setStageId(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todos os estágios</option>
            {stages.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
          <select
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas as origens</option>
            {(Object.keys(SOURCE_LABELS) as LeadSource[]).map((k) => (
              <option key={k} value={k}>
                {SOURCE_LABELS[k]}
              </option>
            ))}
          </select>
          <select
            value={tagId}
            onChange={(e) => setTagId(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm"
          >
            <option value="">Todas as tags</option>
            {tags.map((tag) => (
              <option key={tag.id} value={tag.id}>
                {tag.name}
              </option>
            ))}
          </select>
          <input
            type="search"
            placeholder="Buscar..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="rounded-sm border border-neutral-300 bg-white px-3 py-2 text-sm"
          />
        </div>
        <Link href="/dashboard/leads/novo">
          <Button>
            <Plus className="mr-2 h-4 w-4" />
            Novo lead
          </Button>
        </Link>
      </div>

      {loading ? (
        <p className="text-neutral-500">Carregando…</p>
      ) : leads.length === 0 ? (
        <p className="text-neutral-500">Nenhum lead encontrado.</p>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {leads.map((lead) => (
            <LeadCard key={lead.id} lead={lead} viewHref={`/dashboard/leads/${lead.id}`} />
          ))}
        </div>
      )}
    </div>
  );
}
