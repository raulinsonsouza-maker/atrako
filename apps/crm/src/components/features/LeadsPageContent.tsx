"use client";

import { useState, useEffect } from "react";
import { clsx } from "clsx";
import { LeadsList } from "./LeadsList";
import { PipelineBoard } from "./PipelineBoard";
import { usePageHeader } from "@/contexts/PageHeaderContext";

export function LeadsPageContent({ tenantId }: { tenantId: string }) {
  const [tab, setTab] = useState<"list" | "pipeline">("pipeline");
  const { setSummary } = usePageHeader();

  useEffect(() => {
    if (tab === "list") setSummary(undefined);
  }, [tab, setSummary]);

  return (
    <div className="space-y-4 p-1 flex flex-col" style={{ height: "calc(100vh - 120px)" }}>
      {/* Header: sem H1 duplicado; subtitulo + tabs */}
      <div className="flex items-center justify-between flex-shrink-0">
        <div>
          <p className="text-subhead text-neutral-500 dark:text-neutral-400">
            Gerencie seus leads
          </p>
        </div>

        {/* Tabs */}
        <div className="flex rounded-md border border-neutral-200 dark:border-neutral-700 overflow-hidden">
          <button
            type="button"
            onClick={() => setTab("pipeline")}
            className={clsx(
              "px-4 py-1.5 text-footnote font-medium transition-colors",
              tab === "pipeline"
                ? "bg-primary-500 text-white"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            )}
          >
            Kanban
          </button>
          <button
            type="button"
            onClick={() => setTab("list")}
            className={clsx(
              "px-4 py-1.5 text-footnote font-medium transition-colors",
              tab === "list"
                ? "bg-primary-500 text-white"
                : "text-neutral-600 hover:bg-neutral-50 dark:text-neutral-400 dark:hover:bg-neutral-800"
            )}
          >
            Lista
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 min-h-0 overflow-hidden flex flex-col">
        {tab === "pipeline" && <PipelineBoard tenantId={tenantId} />}
        {tab === "list" && <LeadsList tenantId={tenantId} />}
      </div>
    </div>
  );
}
