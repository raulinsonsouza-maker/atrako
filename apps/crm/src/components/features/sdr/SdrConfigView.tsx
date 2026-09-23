"use client";

import { useState } from "react";
import { clsx } from "clsx";
import type { TenantSdrConfig } from "@/lib/sdr/types";
import {
  SdrIdentidadeTab,
  SdrTomTab,
  SdrRegrasTab,
  SdrQualificacaoTab,
  SdrHandoffTab,
  SdrHorariosTab,
  SdrSegurancaTab,
  SdrSimulacaoTab,
} from "./index";

const TABS = [
  { id: "identidade", label: "Identidade" },
  { id: "tom", label: "Tom de voz" },
  { id: "regras", label: "Regras de atendimento" },
  { id: "qualificacao", label: "Qualificação" },
  { id: "handoff", label: "Handoff humano" },
  { id: "horarios", label: "Horários e canais" },
  { id: "seguranca", label: "Segurança e limites" },
  { id: "simulacao", label: "Teste e simulação" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export function SdrConfigView({
  tenantId,
  initialConfig,
  isAdmin,
}: {
  tenantId: string;
  initialConfig: TenantSdrConfig;
  isAdmin: boolean;
}) {
  const [activeTab, setActiveTab] = useState<TabId>("identidade");

  return (
    <div className="space-y-4">
      <nav
        className="flex flex-wrap gap-1 border-b border-neutral-200 dark:border-neutral-800 pb-2"
        aria-label="Abas SDR"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={clsx(
              "rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              activeTab === tab.id
                ? "bg-primary-500/15 text-primary-600 dark:bg-primary-400/20 dark:text-primary-400"
                : "text-neutral-600 hover:bg-neutral-100 dark:text-neutral-400 dark:hover:bg-neutral-800"
            )}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      <div>
        {activeTab === "identidade" && (
          <SdrIdentidadeTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "tom" && (
          <SdrTomTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "regras" && (
          <SdrRegrasTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "qualificacao" && (
          <SdrQualificacaoTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "handoff" && (
          <SdrHandoffTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "horarios" && (
          <SdrHorariosTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "seguranca" && (
          <SdrSegurancaTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
        {activeTab === "simulacao" && (
          <SdrSimulacaoTab tenantId={tenantId} initialConfig={initialConfig} isAdmin={isAdmin} />
        )}
      </div>
    </div>
  );
}
