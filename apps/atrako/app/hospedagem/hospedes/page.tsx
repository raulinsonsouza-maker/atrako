"use client";

import { useQuery } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { formatBrDate } from "@/lib/stay/nights";

type Guest = {
  id: string;
  name: string;
  phone: string;
  lastStay: { checkIn: string; checkOut: string } | null;
  nextStay: { checkIn: string; checkOut: string } | null;
};

function when(stay: { checkIn: string; checkOut: string } | null) {
  if (!stay) return "—";
  return `${formatBrDate(stay.checkIn)} – ${formatBrDate(stay.checkOut)}`;
}

export default function StayGuestsPage() {
  const { workspaceId, isError } = useActiveWorkspace();
  const { data, isLoading } = useQuery({
    queryKey: ["stay-guests", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay/guests?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar os hóspedes");
      return res.json() as Promise<{ guests: Guest[] }>;
    },
  });
  const guests = data?.guests ?? [];
  const ready = Boolean(workspaceId);

  return (
    <section>
      <h1 className="type-tagline">Hóspedes</h1>
      <p className="type-body mt-2 text-[var(--ink-muted-80)]">Quem já ficou ou ainda vai ficar nesta casa.</p>
      {!ready || isLoading ? <p className="type-body mt-6">Carregando…</p> : null}
      {isError ? <p className="type-body mt-6">Entre de novo para ver os hóspedes.</p> : null}
      {ready && !isLoading && !isError && guests.length === 0 ? <p className="type-body mt-6 text-[var(--ink-muted-80)]">Nenhum hóspede ainda.</p> : null}
      {guests.length > 0 ? (
        <ul className="mt-6 divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-5">
          {guests.map((guest) => (
            <li key={guest.id} className="grid gap-2 py-4 sm:grid-cols-[1.2fr_1fr_1fr_1fr] sm:items-center">
              <span className="type-body-strong">{guest.name}</span>
              <span className="type-body">{guest.phone}</span>
              <span className="type-caption text-[var(--ink-muted-80)]">Última {when(guest.lastStay)}</span>
              <span className="type-caption text-[var(--ink-muted-80)]">Próxima {when(guest.nextStay)}</span>
            </li>
          ))}
        </ul>
      ) : null}
    </section>
  );
}
