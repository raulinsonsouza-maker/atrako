"use client";

import { AgendaWorkspaceGate } from "@/components/agenda/AgendaWorkspaceClient";
import { AgendaCalendarView } from "@/components/agenda/AgendaCalendarView";

export default function AgendaPage() {
  return (
    <AgendaWorkspaceGate title="Agenda" hideSubNav>
      {({ workspaceId }) => <AgendaCalendarView workspaceId={workspaceId} />}
    </AgendaWorkspaceGate>
  );
}
