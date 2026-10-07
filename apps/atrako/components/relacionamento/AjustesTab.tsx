"use client";

import { SegmentedControl } from "@/components/ui";
import { AJUSTES_SECTIONS, type AjustesSection } from "@/components/relacionamento/nav";
import { ThemeTab } from "@/components/relacionamento/ThemeTab";
import { TemplatesTab } from "@/components/relacionamento/TemplatesTab";
import { ContatosAjustes } from "@/components/relacionamento/ContatosTab";
import { CalendarSettings } from "@/components/relacionamento/CalendarSettings";
import { RelSection } from "@/components/relacionamento/ui";

/** Tudo que se configura uma vez: visual do e-mail, modelos de WhatsApp, contatos e datas. */
export function AjustesTab({ workspaceId, sub, onSub }: { workspaceId: string; sub?: string; onSub: (sub: string) => void }) {
  const view: AjustesSection = AJUSTES_SECTIONS.some((s) => s.value === sub) ? (sub as AjustesSection) : "email";
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        className="self-start"
        aria-label="Seção dos ajustes"
        value={view}
        onChange={onSub}
        options={AJUSTES_SECTIONS.map((s) => ({ value: s.value, label: s.label }))}
      />
      {view === "email" ? <ThemeTab workspaceId={workspaceId} /> : null}
      {view === "whatsapp" ? <TemplatesTab workspaceId={workspaceId} /> : null}
      {view === "contatos" ? <ContatosAjustes workspaceId={workspaceId} /> : null}
      {view === "datas" ? (
        <RelSection
          title="Datas do calendário"
          info="Para cada data ligada, a campanha nasce sozinha com a antecedência escolhida e a equipe é avisada."
        >
          <CalendarSettings workspaceId={workspaceId} />
        </RelSection>
      ) : null}
    </div>
  );
}
