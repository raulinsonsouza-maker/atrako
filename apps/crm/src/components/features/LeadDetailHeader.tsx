"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useSearchParams, useRouter } from "next/navigation";
import { ArrowLeft, Calendar } from "lucide-react";
import { Badge, Button } from "@/design/components";
import { ScheduleMeetingModal } from "./ScheduleMeetingModal";

interface LeadDetailHeaderProps {
  lead: {
    id: string;
    name: string;
    email: string;
    phone?: string | null;
    assignedTo?: { name: string } | null;
    stage?: { name: string } | null;
    status: string;
    dealValue?: number | null;
  };
  statusLabel: string;
  dealValueFormatted?: string | null;
  isCalendarConnected: boolean;
}

export function LeadDetailHeader({
  lead,
  statusLabel,
  dealValueFormatted,
  isCalendarConnected,
}: LeadDetailHeaderProps) {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [isScheduleModalOpen, setIsScheduleModalOpen] = useState(false);

  // Abre o modal automaticamente se o query param 'schedule' está presente
  useEffect(() => {
    if (searchParams.get("schedule") === "true") {
      setIsScheduleModalOpen(true);
      // Remove o query param da URL para evitar reabrir ao recarregar
      router.replace(`/dashboard/leads/${lead.id}`, { scroll: false });
    }
  }, [searchParams, router, lead.id]);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="space-y-2">
          <Link
            href="/dashboard/leads"
            className="inline-flex items-center gap-2 text-sm text-neutral-600 hover:text-neutral-900 dark:text-neutral-400 dark:hover:text-neutral-100"
          >
            <ArrowLeft className="h-4 w-4" />
            Voltar
          </Link>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">
              {lead.name}
            </h1>
            <div className="mt-1 flex flex-wrap items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
              <span>{lead.email}</span>
              {lead.phone && <span>· {lead.phone}</span>}
              {lead.assignedTo?.name && <span>· Resp: {lead.assignedTo.name}</span>}
            </div>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <Button
            variant="primary"
            size="sm"
            onClick={() => setIsScheduleModalOpen(true)}
            className="gap-2"
          >
            <Calendar className="h-4 w-4" />
            Agendar Reunião
          </Button>
          <Badge variant="outline">Etapa: {lead.stage?.name ?? "Sem etapa"}</Badge>
          <Badge
            variant={
              lead.status === "WON" ? "success" : lead.status === "LOST" ? "error" : "outline"
            }
          >
            Status: {statusLabel}
          </Badge>
          {dealValueFormatted && <Badge variant="outline">Valor: {dealValueFormatted}</Badge>}
        </div>
      </div>

      <ScheduleMeetingModal
        leadId={lead.id}
        leadName={lead.name}
        leadEmail={lead.email}
        open={isScheduleModalOpen}
        onClose={() => setIsScheduleModalOpen(false)}
        isCalendarConnected={isCalendarConnected}
      />
    </>
  );
}
