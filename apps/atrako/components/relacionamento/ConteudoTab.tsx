"use client";

import { SegmentedControl } from "@/components/ui";
import { ThemeTab } from "@/components/relacionamento/ThemeTab";
import { TemplatesTab } from "@/components/relacionamento/TemplatesTab";

export function ConteudoTab({ workspaceId, sub, onSub }: { workspaceId: string; sub?: string; onSub: (sub: string) => void }) {
  const view = sub === "whatsapp" ? "whatsapp" : "email";
  return (
    <div className="flex flex-col gap-4">
      <SegmentedControl
        className="self-start"
        aria-label="Canal do conteúdo"
        value={view}
        onChange={onSub}
        options={[
          { value: "email", label: "E-mail" },
          { value: "whatsapp", label: "WhatsApp" },
        ]}
      />
      {view === "whatsapp" ? <TemplatesTab workspaceId={workspaceId} /> : <ThemeTab workspaceId={workspaceId} />}
    </div>
  );
}
