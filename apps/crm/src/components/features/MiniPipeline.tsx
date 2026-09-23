"use client";

import Link from "next/link";
import { clsx } from "clsx";
import { ChevronRight } from "lucide-react";

interface Stage {
  id: string;
  name: string;
  color: string;
  count: number;
}

interface MiniPipelineProps {
  stages: Stage[];
  totalLeads: number;
  className?: string;
}

export function MiniPipeline({ stages, totalLeads, className }: MiniPipelineProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div
      className={clsx(
        "rounded-xl p-4",
        "bg-white dark:bg-neutral-900",
        "border border-neutral-200/60 dark:border-neutral-800",
        "shadow-card",
        className
      )}
    >
      {/* Header */}
      <div className="mb-4 flex items-center justify-between">
        <div>
          <h3 className="text-headline font-semibold text-neutral-900 dark:text-neutral-100">
            Pipeline
          </h3>
          <p className="text-caption-1 text-neutral-500 dark:text-neutral-400">
            {totalLeads} leads no funil
          </p>
        </div>
        <Link
          href="/dashboard/leads"
          className={clsx(
            "flex items-center gap-0.5 text-footnote font-medium",
            "text-primary-500 hover:text-primary-600",
            "transition-colors duration-fast"
          )}
        >
          Ver tudo
          <ChevronRight className="h-4 w-4" />
        </Link>
      </div>

      {/* Stages */}
      <div className="space-y-3">
        {stages.map((stage) => {
          const percentage = (stage.count / maxCount) * 100;
          return (
            <div key={stage.id}>
              <div className="mb-1 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span
                    className="h-2 w-2 rounded-full"
                    style={{ backgroundColor: stage.color }}
                  />
                  <span className="text-footnote text-neutral-700 dark:text-neutral-300">
                    {stage.name}
                  </span>
                </div>
                <span className="text-footnote font-semibold text-neutral-900 dark:text-neutral-100">
                  {stage.count}
                </span>
              </div>
              <div className="h-1.5 overflow-hidden rounded-full bg-neutral-100 dark:bg-neutral-800">
                <div
                  className="h-full rounded-full transition-all duration-500 ease-apple"
                  style={{
                    width: `${percentage}%`,
                    backgroundColor: stage.color,
                  }}
                />
              </div>
            </div>
          );
        })}
      </div>

      {stages.length === 0 && (
        <div className="py-6 text-center">
          <p className="text-footnote text-neutral-500 dark:text-neutral-400">
            Nenhum estagio configurado
          </p>
        </div>
      )}
    </div>
  );
}
