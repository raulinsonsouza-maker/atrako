"use client";

import Link from "next/link";
import { Modal, Button } from "@/design/components";
import { Mail, Phone, User, Calendar } from "lucide-react";

type Lead = {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  assignedTo: { id: string; name: string } | null;
  source?: string | null;
  dealValue?: number | null;
  createdAt?: Date | string;
};

const SOURCE_LABELS: Record<string, string> = {
  META: "Meta",
  GOOGLE: "Google",
  WHATSAPP: "WhatsApp",
  MANUAL: "Manual",
  OUTROS: "Outros",
};

function formatCurrency(value: number) {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
    minimumFractionDigits: 0,
  }).format(value);
}

export function LeadPreviewModal({
  open,
  onClose,
  lead,
}: {
  open: boolean;
  onClose: () => void;
  lead: Lead | null;
}) {
  if (!lead) return null;

  const viewHref = `/dashboard/leads/${lead.id}`;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lead.name}
      size="md"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="outline" onClick={onClose}>
            Fechar
          </Button>
          <Link href={viewHref} onClick={onClose}>
            <Button>Ver detalhes completos</Button>
          </Link>
        </div>
      }
    >
      <div className="space-y-4">
        {lead.source && (
          <div>
            <span className="text-[11px] font-medium uppercase text-neutral-400 dark:text-neutral-500">
              Origem
            </span>
            <p className="text-sm text-neutral-900 dark:text-neutral-100">
              {SOURCE_LABELS[lead.source] ?? lead.source}
            </p>
          </div>
        )}

        {lead.email && (
          <div className="flex items-center gap-2">
            <Mail className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            <a
              href={`mailto:${lead.email}`}
              className="text-sm text-primary-600 hover:underline dark:text-primary-400"
            >
              {lead.email}
            </a>
          </div>
        )}

        {lead.phone && (
          <div className="flex items-center gap-2">
            <Phone className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            <a
              href={`tel:${lead.phone}`}
              className="text-sm text-primary-600 hover:underline dark:text-primary-400"
            >
              {lead.phone}
            </a>
          </div>
        )}

        {lead.assignedTo && (
          <div className="flex items-center gap-2">
            <User className="h-4 w-4 shrink-0 text-neutral-400" strokeWidth={1.75} />
            <span className="text-sm text-neutral-700 dark:text-neutral-300">
              {lead.assignedTo.name}
            </span>
          </div>
        )}

        {lead.dealValue != null && lead.dealValue > 0 && (
          <div>
            <span className="text-[11px] font-medium uppercase text-neutral-400 dark:text-neutral-500">
              Valor
            </span>
            <p className="text-base font-semibold text-primary-600 dark:text-primary-400">
              {formatCurrency(lead.dealValue)}
            </p>
          </div>
        )}

        {lead.createdAt && (
          <div className="flex items-center gap-2 text-sm text-neutral-500 dark:text-neutral-400">
            <Calendar className="h-4 w-4 shrink-0" strokeWidth={1.75} />
            Criado em {new Date(lead.createdAt).toLocaleDateString("pt-BR", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          </div>
        )}
      </div>
    </Modal>
  );
}
