import { Suspense } from "react";
import { FlowEditClient } from "@/components/symbius/FlowEditClient";

export default async function FlowEditPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="p-10 text-[var(--symbius-muted)]">Carregando…</div>
      }
    >
      <FlowEditClient fluxoId={id} />
    </Suspense>
  );
}
