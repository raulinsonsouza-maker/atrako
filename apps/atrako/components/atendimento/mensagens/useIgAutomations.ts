import { useEffect, useState } from "react";

export type IgFluxo = {
  id: string;
  nome: string;
  status: "DRAFT" | "PUBLISHED" | string;
  triggerType: string | null;
  triggerConfig: Record<string, unknown> | null;
  fluxoKind: string | null;
  igAccountId?: string | null;
  pasta?: { id: string; nome: string } | null;
  updatedAt: string;
  _count?: { nos: number; execucoes: number };
};

export type IgMetrics = Record<string, unknown> | null;

export function useIgAutomations(workspaceId?: string) {
  const [flows, setFlows] = useState<IgFluxo[]>([]);
  const [metrics, setMetrics] = useState<IgMetrics>(null);
  const [igAccount, setIgAccount] = useState<string | null>(null);
  const [instagramConnected, setInstagramConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : "";

  async function load() {
    setIsLoading(true);
    setError(null);
    try {
      const [flowsRes, metricsRes] = await Promise.all([
        fetch(`/api/symbius/flows${qs}`, { cache: "no-store" }),
        fetch(`/api/symbius/analytics${qs}`, { cache: "no-store" }),
      ]);
      if (!flowsRes.ok) throw new Error("Falha ao carregar fluxos");
      const flowsData = await flowsRes.json();
      setFlows(flowsData.fluxos ?? []);
      setInstagramConnected(Boolean(flowsData.instagramConnected));
      if (metricsRes.ok) {
        const metricsData = await metricsRes.json();
        setMetrics(metricsData);
      }
      const firstWithIg = (flowsData.fluxos ?? []).find((f: IgFluxo) => f.igAccountId);
      if (firstWithIg?.igAccountId) setIgAccount(firstWithIg.igAccountId);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro desconhecido");
    } finally {
      setIsLoading(false);
    }
  }

  useEffect(() => {
    void load();
    // load lê o workspaceId deste render
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [workspaceId]);

  return { flows, metrics, igAccount, instagramConnected, isLoading, error, refetch: load };
}