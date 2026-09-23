"use client";

import { useState, useEffect } from "react";
import { listLossReasons } from "@/server/actions/lossReason";

interface LossReasonSelectProps {
  tenantId: string;
  name?: string;
  value?: string;
  defaultValue?: string | null;
  onChange?: (e: React.ChangeEvent<HTMLSelectElement>) => void;
  className?: string;
  placeholder?: string;
}

export function LossReasonSelect({
  tenantId,
  name = "lossReasonId",
  value,
  defaultValue,
  onChange,
  className = "w-full rounded-sm border border-neutral-300 bg-white px-3 py-2 dark:border-neutral-600 dark:bg-neutral-800 dark:text-neutral-100",
  placeholder = "Selecione um motivo...",
}: LossReasonSelectProps) {
  const [reasons, setReasons] = useState<{ id: string; name: string }[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listLossReasons(tenantId)
      .then(setReasons)
      .catch(() => setReasons([]))
      .finally(() => setLoading(false));
  }, [tenantId]);

  if (loading) {
    return (
      <select name={name} className={className} disabled>
        <option>Carregando...</option>
      </select>
    );
  }

  return (
    <>
      <select
        name={name}
        value={value !== undefined ? value : defaultValue ?? ""}
        defaultValue={value === undefined ? defaultValue ?? "" : undefined}
        onChange={onChange}
        className={className}
      >
        <option value="">{placeholder}</option>
        {reasons.map((reason) => (
          <option key={reason.id} value={reason.id}>
            {reason.name}
          </option>
        ))}
      </select>
      {reasons.length === 0 && (
        <p className="mt-1 text-xs text-neutral-500">
          Nenhum motivo cadastrado. Configure em{" "}
          <a href="/dashboard/configuracoes" className="text-primary-600 hover:underline">
            Configurações
          </a>
          .
        </p>
      )}
    </>
  );
}
