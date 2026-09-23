"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, CheckCircle2, Loader2, Plus, Trash2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { Button } from "@/components/ui/button";
import { BackLink } from "@/components/ui/back-link";
import { PillSelect } from "@/components/ui/pill-select";
import { SearchInput } from "@/components/ui/search-input";
import type { MetaCampaignBuilderDraft, MetaAdSetDraft, MetaAdDraft } from "@/lib/integrations/meta/campaign-builder/draft-types";
import type { UiObjective } from "@/lib/integrations/meta/campaign-builder/objective-config";
import { OBJECTIVE_CONFIG } from "@/lib/integrations/meta/campaign-builder/objective-config";
import {
  ATRAKO_PLACEMENT_GROUPS,
  defaultPlacementSelection,
  metaPositionsToSelection,
  selectionToMetaPositions,
} from "@/lib/integrations/meta/campaign-builder/placements-config";
import {
  blobToBase64,
  cropImageToAspect,
  type AspectPreset,
} from "@/lib/integrations/meta/campaign-builder/image-crop";

const STEPS = [
  "Configuração",
  "Conjuntos",
  "Público",
  "Destino",
  "Criativos",
  "Revisão",
  "Publicação",
] as const;

function newLocalKey() {
  return `k_${Math.random().toString(36).slice(2, 10)}`;
}

function normalizePlacements(
  placements?: MetaAdSetDraft["placements"],
): MetaAdSetDraft["placements"] {
  const selection =
    placements?.selection ||
    (placements?.facebookPositions || placements?.instagramPositions
      ? metaPositionsToSelection({
          facebookPositions: placements.facebookPositions,
          instagramPositions: placements.instagramPositions,
        })
      : defaultPlacementSelection());
  const pos = selectionToMetaPositions(selection);
  return {
    mode: "MANUAL",
    selection,
    publisherPlatforms: pos.publisherPlatforms,
    facebookPositions: pos.facebookPositions,
    instagramPositions: pos.instagramPositions,
  };
}

function normalizeDraft(d: MetaCampaignBuilderDraft): MetaCampaignBuilderDraft {
  return {
    ...d,
    adSets: (d.adSets || []).map((s) => ({
      ...s,
      placements: normalizePlacements(s.placements),
    })),
  };
}

function emptyAd(): MetaAdDraft {
  return {
    localKey: newLocalKey(),
    name: "Anúncio 01",
    creative: {
      type: "IMAGE",
      primaryText: "",
      headline: "",
      description: "",
      callToAction: "LEARN_MORE",
    },
  };
}

function emptyAdSet(): MetaAdSetDraft {
  const selection = defaultPlacementSelection();
  const pos = selectionToMetaPositions(selection);
  return {
    localKey: newLocalKey(),
    name: "Conjunto 01",
    budget: { type: "DAILY", amount: 50 },
    bidStrategy: "LOWEST_COST_WITHOUT_CAP",
    optimizationGoal: "LINK_CLICKS",
    targeting: { countries: ["BR"], ageMin: 18, ageMax: 65, genders: [] },
    placements: {
      mode: "MANUAL",
      publisherPlatforms: pos.publisherPlatforms,
      facebookPositions: pos.facebookPositions,
      instagramPositions: pos.instagramPositions,
      selection,
    },
    advantageAudience: true,
    destination: {
      type: "WEBSITE",
      url: "",
      utmSource: "meta",
      utmMedium: "paid_social",
      utmCampaign: "",
      utmContent: "",
    },
    ads: [emptyAd()],
  };
}

function emptyDraft(adAccountId = ""): MetaCampaignBuilderDraft {
  return {
    account: { adAccountId },
    campaign: {
      name: "",
      objective: "TRAFFIC",
      specialAdCategories: [],
      buyingType: "AUCTION",
    },
    adSets: [emptyAdSet()],
    identity: { pageId: "" },
    status: "PAUSED",
  };
}

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

type Bootstrap = {
  connection: { connected: boolean; health: string; selectedAdAccountId: string | null };
  accounts: Array<{ id: string; name: string }>;
  pages: Array<{ id: string; name?: string; instagramId?: string }>;
  pixels: Array<{ id: string; name?: string }>;
  instagram: Array<{ id: string; name?: string }>;
  objectives: Array<{ value: UiObjective; label: string }>;
  specialAdCategories: Array<{ value: string; label: string }>;
  bidStrategies: Array<{ value: string; label: string }>;
  objectiveConfigs: Record<
    string,
    {
      optimizationGoals: Array<{ value: string; label: string }>;
      ctas: Array<{ value: string; label: string }>;
      destinations: Array<{ value: string; label: string }>;
      needsPixel: boolean;
    }
  >;
};

export function CampanhaMetaWizard({ initialDraftId }: { initialDraftId?: string } = {}) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const workspaceFromUrl = searchParams.get("workspaceId");
  const draftIdFromUrl = searchParams.get("draftId") || initialDraftId || "";
  const objectiveFromUrl = searchParams.get("objective");
  const optGoalFromUrl = searchParams.get("optimizationGoal");

  const [workspaceId, setWorkspaceId] = useState(workspaceFromUrl || "");
  const [step, setStep] = useState(0);
  const [draft, setDraft] = useState<MetaCampaignBuilderDraft>(() => {
    const d = emptyDraft();
    const ui = objectiveFromUrl as UiObjective | null;
    if (ui && OBJECTIVE_CONFIG[ui]) {
      d.campaign.objective = ui;
      const goals = OBJECTIVE_CONFIG[ui].optimizationGoals;
      const goal =
        (optGoalFromUrl && goals.some((g) => g.value === optGoalFromUrl)
          ? optGoalFromUrl
          : goals[0]?.value) || d.adSets[0]?.optimizationGoal;
      if (d.adSets[0] && goal) d.adSets[0].optimizationGoal = goal;
    }
    return d;
  });
  const [draftId, setDraftId] = useState<string | null>(draftIdFromUrl || null);
  const [creationRequestId] = useState(() => crypto.randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [issues, setIssues] = useState<Array<{ message: string }>>([]);
  const [publishResult, setPublishResult] = useState<{
    ok: boolean;
    status: string;
    campaignId?: string;
    metaCampaignId?: string;
    error?: string;
  } | null>(null);
  const [interestQ, setInterestQ] = useState("");
  const [interestResults, setInterestResults] = useState<Array<{ id: string; name: string }>>([]);
  const [videoUrlDraft, setVideoUrlDraft] = useState<Record<string, string>>({});
  const [draftLoaded, setDraftLoaded] = useState(!draftIdFromUrl);

  const { data: clientes = [] } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });

  useEffect(() => {
    if (!workspaceId && clientes[0]?.id) setWorkspaceId(clientes[0].id);
  }, [clientes, workspaceId]);

  // Reabrir draft salvo
  useEffect(() => {
    if (!draftIdFromUrl || !workspaceId || draftLoaded) return;
    let cancelled = false;
    (async () => {
      try {
        const r = await fetch(
          `/api/atrako/meta/campaign-builder?workspaceId=${workspaceId}&draftId=${draftIdFromUrl}`,
        );
        if (!r.ok) return;
        const row = await r.json();
        if (cancelled) return;
        if (row.payload) setDraft(normalizeDraft(row.payload as MetaCampaignBuilderDraft));
        setDraftId(row.id);
        if (row.status === "PUBLISHED" || row.status === "PARTIAL") {
          setPublishResult({
            ok: row.status === "PUBLISHED",
            status: row.status,
            campaignId: row.publishedCampaignId || row.publishedCampaign?.id,
            metaCampaignId: row.publishedCampaign?.metaCampaignId,
            error: row.lastError || undefined,
          });
          setStep(6);
        }
      } finally {
        if (!cancelled) setDraftLoaded(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [draftIdFromUrl, workspaceId, draftLoaded]);

  const { data: boot, isLoading: loadingBoot } = useQuery({
    queryKey: ["meta-builder-boot", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/meta/builder/bootstrap?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("Falha ao carregar dados Meta");
      return r.json() as Promise<Bootstrap>;
    },
    enabled: Boolean(workspaceId),
  });

  useEffect(() => {
    if (!boot) return;
    setDraft((d) => ({
      ...d,
      account: {
        ...d.account,
        adAccountId:
          d.account.adAccountId ||
          boot.connection.selectedAdAccountId ||
          boot.accounts[0]?.id ||
          "",
        businessId: d.account.businessId,
      },
      identity: {
        pageId: d.identity.pageId || boot.pages[0]?.id || "",
        instagramActorId:
          d.identity.instagramActorId ||
          boot.pages[0]?.instagramId ||
          boot.instagram[0]?.id,
      },
    }));
  }, [boot]);

  const objCfg = boot?.objectiveConfigs?.[draft.campaign.objective];

  useEffect(() => {
    if (!objCfg) return;
    setDraft((d) => {
      const next = { ...d, adSets: d.adSets.map((s) => ({ ...s })) };
      for (const s of next.adSets) {
        if (!objCfg.optimizationGoals.some((g) => g.value === s.optimizationGoal)) {
          s.optimizationGoal = objCfg.optimizationGoals[0]?.value || s.optimizationGoal;
        }
      }
      return next;
    });
  }, [draft.campaign.objective, objCfg]);

  const updateAdSet = useCallback((index: number, patch: Partial<MetaAdSetDraft>) => {
    setDraft((d) => {
      const adSets = d.adSets.map((s, i) => (i === index ? { ...s, ...patch } : s));
      return { ...d, adSets };
    });
  }, []);

  const summary = useMemo(() => {
    const ads = draft.adSets.reduce((n, s) => n + s.ads.length, 0);
    const budget = draft.adSets[0]?.budget;
    return {
      name: draft.campaign.name || "—",
      objective: boot?.objectives.find((o) => o.value === draft.campaign.objective)?.label || "—",
      budget: budget ? `R$ ${budget.amount}/${budget.type === "DAILY" ? "dia" : "total"}` : "—",
      ads,
      status: "PAUSADO",
    };
  }, [draft, boot]);

  async function validate() {
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/meta/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "validate", draft }),
      });
      const j = await r.json();
      setIssues(j.issues || []);
      return Boolean(j.ok);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      return false;
    } finally {
      setBusy(false);
    }
  }

  async function publish() {
    setBusy(true);
    setError(null);
    setPublishResult(null);
    try {
      const ok = await validate();
      if (!ok) {
        setStep(5);
        return;
      }
      const r = await fetch("/api/atrako/meta/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "create",
          draft,
          creationRequestId,
          draftId: draftId || undefined,
        }),
      });
      const j = await r.json();
      if (j.draftId) setDraftId(j.draftId);
      setPublishResult(j);
      setStep(6);
      if (!j.ok && j.error) setError(j.error);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (!draftId) return publish();
    setBusy(true);
    try {
      const r = await fetch("/api/atrako/meta/campaign-builder", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "retry", draftId }),
      });
      const j = await r.json();
      setPublishResult(j);
      if (!j.ok && j.error) setError(j.error);
    } finally {
      setBusy(false);
    }
  }

  async function activate() {
    if (!publishResult?.campaignId) return;
    setBusy(true);
    try {
      await fetch(`/api/atrako/meta/campaigns/${publishResult.campaignId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "activate" }),
      });
      setPublishResult((p) => (p ? { ...p, status: "ACTIVE" } : p));
    } finally {
      setBusy(false);
    }
  }

  async function uploadStaticAspect(
    adSetIdx: number,
    adIdx: number,
    file: File,
    preset: AspectPreset,
  ) {
    if (!draft.account.adAccountId) return;
    setBusy(true);
    setError(null);
    try {
      const { blob, filename } = await cropImageToAspect(file, preset);
      const base64 = await blobToBase64(blob);
      const r = await fetch("/api/atrako/meta/builder/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          adAccountId: draft.account.adAccountId,
          filename,
          base64,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha no upload");
      setDraft((d) => {
        const adSets = d.adSets.map((s, i) => {
          if (i !== adSetIdx) return s;
          const ads = s.ads.map((a, k) => {
            if (k !== adIdx) return a;
            if (preset === "1:1") {
              return {
                ...a,
                creative: {
                  ...a.creative,
                  type: "IMAGE" as const,
                  imageHashSquare: j.imageHash,
                  imageHash: j.imageHash,
                },
              };
            }
            return {
              ...a,
              creative: {
                ...a.creative,
                type: "IMAGE" as const,
                imageHashVertical: j.imageHash,
              },
            };
          });
          return { ...s, ads };
        });
        return { ...d, adSets };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadCarouselCard(
    adSetIdx: number,
    adIdx: number,
    cardIdx: number,
    file: File,
  ) {
    if (!draft.account.adAccountId) return;
    setBusy(true);
    setError(null);
    try {
      const buf = await file.arrayBuffer();
      const bytes = new Uint8Array(buf);
      let binary = "";
      for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]!);
      const base64 = btoa(binary);
      const r = await fetch("/api/atrako/meta/builder/upload-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          adAccountId: draft.account.adAccountId,
          filename: file.name,
          base64,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha no upload");
      setDraft((d) => {
        const adSets = d.adSets.map((s, i) => {
          if (i !== adSetIdx) return s;
          const ads = s.ads.map((a, k) => {
            if (k !== adIdx) return a;
            const cards = [...(a.creative.carouselCards || [])];
            while (cards.length <= cardIdx) cards.push({ imageHash: "" });
            cards[cardIdx] = { ...cards[cardIdx]!, imageHash: j.imageHash };
            return {
              ...a,
              creative: { ...a.creative, type: "CAROUSEL" as const, carouselCards: cards },
            };
          });
          return { ...s, ads };
        });
        return { ...d, adSets };
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function uploadVideo(adSetIdx: number, adIdx: number, fileUrl: string) {
    if (!draft.account.adAccountId || !fileUrl.trim()) return;
    setBusy(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/meta/builder/upload-video", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          adAccountId: draft.account.adAccountId,
          fileUrl: fileUrl.trim(),
          title: draft.adSets[adSetIdx]?.ads[adIdx]?.name || "video",
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Falha no upload de vídeo");
      setDraft((d) => {
        const adSets = d.adSets.map((s, i) => {
          if (i !== adSetIdx) return s;
          const ads = s.ads.map((a, k) =>
            k === adIdx
              ? { ...a, creative: { ...a.creative, type: "VIDEO" as const, videoId: j.videoId } }
              : a,
          );
          return { ...s, ads };
        });
        return { ...d, adSets };
      });
      if (j.status === "error") setError("Vídeo enviado, mas Meta reportou erro no processamento.");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  async function pauseCampaign() {
    if (!publishResult?.campaignId) return;
    setBusy(true);
    try {
      await fetch(`/api/atrako/meta/campaigns/${publishResult.campaignId}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "pause" }),
      });
      setPublishResult((p) => (p ? { ...p, status: "PAUSED" } : p));
    } finally {
      setBusy(false);
    }
  }

  async function searchInterests() {
    if (!interestQ.trim() || !workspaceId) return;
    const r = await fetch(
      `/api/atrako/meta/builder/targeting-search?workspaceId=${workspaceId}&q=${encodeURIComponent(interestQ)}`,
    );
    const j = await r.json();
    setInterestResults(j.results || []);
  }

  const metaReady = boot?.connection?.connected && boot.connection.health === "ready";

  return (
    <AppPage title="Campanha Meta" actions={<BackLink href="/criar/p/anuncios" />}>
      <p className="type-body text-[var(--ink-muted-80)]">
        Monte a campanha no Atrako e publique pausada na Meta.
      </p>

      {!workspaceId || loadingBoot ? (
        <div className="flex justify-center py-16">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      ) : !metaReady ? (
        <div className="mt-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-4 text-amber-950">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
          <div>
            <p className="type-fine-print">
              Conecte a Meta Ads desta empresa antes de criar campanhas.
            </p>
            <Link
              href={`/config/conexoes?workspaceId=${workspaceId}`}
              className="mt-2 inline-flex type-fine-print text-[var(--primary)]"
            >
              Ir para Integrações →
            </Link>
          </div>
        </div>
      ) : (
        <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_280px]">
          <div className="space-y-4">
            <div className="flex flex-wrap gap-2">
              {STEPS.map((label, i) => (
                <button
                  key={label}
                  type="button"
                  onClick={() => setStep(i)}
                  className={`rounded-[var(--radius-xs)] px-3 py-1.5 type-micro-legal ${
                    i === step
                      ? "bg-[var(--primary)] text-[var(--on-primary)]"
                      : "bg-[var(--canvas-parchment)] text-[var(--ink-muted-80)]"
                  }`}
                >
                  {i + 1}. {label}
                </button>
              ))}
            </div>

            {error ? (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 type-fine-print text-red-800">
                {error}
              </div>
            ) : null}

            {step === 0 && (
              <section className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5">
                <label className="block type-fine-print text-[var(--ink-muted-48)]">
                  Empresa
                  <PillSelect
                    className="mt-1 w-full"
                    size="field"
                    value={workspaceId}
                    onChange={setWorkspaceId}
                    options={clientes.map((c: { id: string; nome: string }) => ({
                      value: c.id,
                      label: c.nome,
                    }))}
                  />
                </label>
                <label className="block type-fine-print text-[var(--ink-muted-48)]">
                  Conta de anúncios
                  <PillSelect
                    className="mt-1 w-full"
                    size="field"
                    value={draft.account.adAccountId}
                    onChange={(v) =>
                      setDraft((d) => ({ ...d, account: { ...d.account, adAccountId: v } }))
                    }
                    options={boot.accounts.map((a) => ({
                      value: a.id,
                      label: a.name || a.id,
                    }))}
                  />
                </label>
                <label className="block type-fine-print text-[var(--ink-muted-48)]">
                  Nome da campanha
                  <input
                    className={fieldClass}
                    value={draft.campaign.name}
                    onChange={(e) =>
                      setDraft((d) => ({
                        ...d,
                        campaign: { ...d.campaign, name: e.target.value },
                      }))
                    }
                    placeholder="VENDA | PRODUTO | BR | SET26"
                  />
                </label>
                <label className="block type-fine-print text-[var(--ink-muted-48)]">
                  Objetivo
                  <PillSelect
                    className="mt-1 w-full"
                    size="field"
                    value={draft.campaign.objective}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        campaign: { ...d.campaign, objective: v as UiObjective },
                      }))
                    }
                    options={boot.objectives.map((o) => ({ value: o.value, label: o.label }))}
                  />
                </label>
                <label className="block type-fine-print text-[var(--ink-muted-48)]">
                  Categoria especial
                  <PillSelect
                    className="mt-1 w-full"
                    size="field"
                    value={draft.campaign.specialAdCategories[0] || ""}
                    onChange={(v) =>
                      setDraft((d) => ({
                        ...d,
                        campaign: {
                          ...d.campaign,
                          specialAdCategories: v ? [v] : [],
                        },
                      }))
                    }
                    options={boot.specialAdCategories.map((c) => ({
                      value: c.value,
                      label: c.label,
                    }))}
                  />
                </label>
              </section>
            )}

            {step === 1 && (
              <section className="space-y-4">
                {draft.adSets.map((set, i) => (
                  <div
                    key={set.localKey}
                    className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5"
                  >
                    <div className="flex items-center justify-between">
                      <h3 className="type-caption-strong">Conjunto {i + 1}</h3>
                      {draft.adSets.length > 1 ? (
                        <button
                          type="button"
                          onClick={() =>
                            setDraft((d) => ({
                              ...d,
                              adSets: d.adSets.filter((_, k) => k !== i),
                            }))
                          }
                          className="text-[var(--ink-muted-48)]"
                        >
                          <Trash2 className="h-4 w-4" />
                        </button>
                      ) : null}
                    </div>
                    <input
                      className={fieldClass}
                      value={set.name}
                      onChange={(e) => updateAdSet(i, { name: e.target.value })}
                      placeholder="Nome do conjunto"
                    />
                    <div className="grid gap-3 sm:grid-cols-2">
                      <PillSelect
                        size="field"
                        value={set.budget.type}
                        onChange={(v) =>
                          updateAdSet(i, {
                            budget: { ...set.budget, type: v as "DAILY" | "LIFETIME" },
                          })
                        }
                        options={[
                          { value: "DAILY", label: "Orçamento diário" },
                          { value: "LIFETIME", label: "Orçamento vitalício" },
                        ]}
                      />
                      <input
                        className={fieldClass}
                        type="number"
                        min={1}
                        step={1}
                        value={set.budget.amount}
                        onChange={(e) =>
                          updateAdSet(i, {
                            budget: { ...set.budget, amount: Number(e.target.value) || 0 },
                          })
                        }
                        placeholder="Valor R$"
                      />
                    </div>
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={set.optimizationGoal}
                      onChange={(v) => updateAdSet(i, { optimizationGoal: v })}
                      options={(objCfg?.optimizationGoals || []).map((g) => ({
                        value: g.value,
                        label: g.label,
                      }))}
                    />
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={set.bidStrategy}
                      onChange={(v) => updateAdSet(i, { bidStrategy: v })}
                      options={boot.bidStrategies.map((b) => ({
                        value: b.value,
                        label: b.label,
                      }))}
                    />
                    {objCfg?.needsPixel ? (
                      <PillSelect
                        size="field"
                        className="w-full"
                        value={set.promotedObject?.pixelId || ""}
                        onChange={(v) =>
                          updateAdSet(i, {
                            promotedObject: {
                              ...set.promotedObject,
                              pixelId: v,
                              customEventType:
                                draft.campaign.objective === "SALES" ? "PURCHASE" : "LEAD",
                            },
                          })
                        }
                        options={[
                          { value: "", label: "Selecione o Pixel" },
                          ...boot.pixels.map((p) => ({
                            value: p.id,
                            label: p.name || p.id,
                          })),
                        ]}
                      />
                    ) : null}
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  onClick={() =>
                    setDraft((d) => ({
                      ...d,
                      adSets: [
                        ...d.adSets,
                        {
                          ...emptyAdSet(),
                          name: `Conjunto ${String(d.adSets.length + 1).padStart(2, "0")}`,
                        },
                      ],
                    }))
                  }
                >
                  <Plus className="mr-1 h-4 w-4" /> Adicionar conjunto
                </Button>
              </section>
            )}

            {step === 2 && (
              <section className="space-y-4">
                {draft.adSets.map((set, i) => (
                  <div
                    key={set.localKey}
                    className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5"
                  >
                    <h3 className="type-caption-strong">{set.name} — Público</h3>
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={set.targeting.countries?.[0] || "BR"}
                      onChange={(v) =>
                        updateAdSet(i, {
                          targeting: { ...set.targeting, countries: [v] },
                        })
                      }
                      options={[
                        { value: "BR", label: "Brasil" },
                        { value: "PT", label: "Portugal" },
                        { value: "US", label: "Estados Unidos" },
                      ]}
                    />
                    <div className="grid grid-cols-2 gap-3">
                      <label className="type-fine-print text-[var(--ink-muted-48)]">
                        Idade mín.
                        <input
                          className={fieldClass}
                          type="number"
                          min={13}
                          max={65}
                          value={set.targeting.ageMin}
                          onChange={(e) =>
                            updateAdSet(i, {
                              targeting: {
                                ...set.targeting,
                                ageMin: Number(e.target.value) || 18,
                              },
                            })
                          }
                        />
                      </label>
                      <label className="type-fine-print text-[var(--ink-muted-48)]">
                        Idade máx.
                        <input
                          className={fieldClass}
                          type="number"
                          min={13}
                          max={65}
                          value={set.targeting.ageMax}
                          onChange={(e) =>
                            updateAdSet(i, {
                              targeting: {
                                ...set.targeting,
                                ageMax: Number(e.target.value) || 65,
                              },
                            })
                          }
                        />
                      </label>
                    </div>
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={
                        !set.targeting.genders?.length
                          ? "all"
                          : set.targeting.genders[0] === 1
                            ? "male"
                            : "female"
                      }
                      onChange={(v) =>
                        updateAdSet(i, {
                          targeting: {
                            ...set.targeting,
                            genders: v === "all" ? [] : v === "male" ? [1] : [2],
                          },
                        })
                      }
                      options={[
                        { value: "all", label: "Todos os gêneros" },
                        { value: "male", label: "Homens" },
                        { value: "female", label: "Mulheres" },
                      ]}
                    />
                    <div className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas-parchment)] p-4">
                      <p className="type-caption-strong">Posicionamentos</p>
                      <p className="type-micro-legal text-[var(--ink-muted-48)]">
                        Somente Facebook e Instagram — Feeds, Stories e Reels.
                      </p>
                      {ATRAKO_PLACEMENT_GROUPS.map((group) => (
                        <div key={group.title} className="space-y-2">
                          <p className="type-fine-print text-[var(--ink-muted-80)]">{group.title}</p>
                          <div className="grid gap-2 sm:grid-cols-2">
                            {group.items.map((item) => (
                              <label
                                key={item.key}
                                className="flex items-center gap-2 type-fine-print"
                              >
                                <input
                                  type="checkbox"
                                  checked={Boolean(set.placements.selection?.[item.key])}
                                  onChange={(e) => {
                                    const selection = {
                                      ...defaultPlacementSelection(),
                                      ...set.placements.selection,
                                      [item.key]: e.target.checked,
                                    };
                                    const pos = selectionToMetaPositions(selection);
                                    updateAdSet(i, {
                                      placements: {
                                        mode: "MANUAL",
                                        selection,
                                        publisherPlatforms: pos.publisherPlatforms,
                                        facebookPositions: pos.facebookPositions,
                                        instagramPositions: pos.instagramPositions,
                                      },
                                    });
                                  }}
                                />
                                {item.label}
                              </label>
                            ))}
                          </div>
                        </div>
                      ))}
                    </div>
                    <label className="flex items-center gap-2 type-fine-print">
                      <input
                        type="checkbox"
                        checked={Boolean(set.advantageAudience)}
                        onChange={(e) => updateAdSet(i, { advantageAudience: e.target.checked })}
                      />
                      Advantage+ Audience
                    </label>
                    <div className="flex gap-2">
                      <SearchInput
                        size="toolbar"
                        placeholder="Buscar interesses…"
                        value={interestQ}
                        onChange={(e) => setInterestQ(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") {
                            e.preventDefault();
                            void searchInterests();
                          }
                        }}
                      />
                      <Button type="button" variant="outline" onClick={searchInterests}>
                        Buscar
                      </Button>
                    </div>
                    {interestResults.length > 0 ? (
                      <ul className="max-h-40 space-y-1 overflow-auto type-fine-print">
                        {interestResults.map((r) => (
                          <li key={r.id}>
                            <button
                              type="button"
                              className="text-left text-[var(--primary)]"
                              onClick={() => {
                                const interests = [
                                  ...(set.targeting.interests || []),
                                  { id: r.id, name: r.name },
                                ];
                                updateAdSet(i, {
                                  targeting: { ...set.targeting, interests },
                                });
                              }}
                            >
                              + {r.name}
                            </button>
                          </li>
                        ))}
                      </ul>
                    ) : null}
                    {(set.targeting.interests?.length ?? 0) > 0 ? (
                      <p className="type-micro-legal text-[var(--ink-muted-48)]">
                        Interesses: {set.targeting.interests!.map((x) => x.name).join(", ")}
                      </p>
                    ) : null}
                  </div>
                ))}
              </section>
            )}

            {step === 3 && (
              <section className="space-y-4">
                {draft.adSets.map((set, i) => (
                  <div
                    key={set.localKey}
                    className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5"
                  >
                    <h3 className="type-caption-strong">{set.name} — Destino</h3>
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={set.destination.type}
                      onChange={(v) =>
                        updateAdSet(i, {
                          destination: { ...set.destination, type: v },
                        })
                      }
                      options={(objCfg?.destinations || [{ value: "WEBSITE", label: "Site" }]).map(
                        (d) => ({ value: d.value, label: d.label }),
                      )}
                    />
                    {set.destination.type === "WEBSITE" ? (
                      <input
                        className={fieldClass}
                        placeholder="https://…"
                        value={set.destination.url || ""}
                        onChange={(e) =>
                          updateAdSet(i, {
                            destination: { ...set.destination, url: e.target.value },
                          })
                        }
                      />
                    ) : null}
                    <div className="grid gap-2 sm:grid-cols-2">
                      <input
                        className={fieldClass}
                        placeholder="utm_source"
                        value={set.destination.utmSource || ""}
                        onChange={(e) =>
                          updateAdSet(i, {
                            destination: { ...set.destination, utmSource: e.target.value },
                          })
                        }
                      />
                      <input
                        className={fieldClass}
                        placeholder="utm_campaign"
                        value={set.destination.utmCampaign || ""}
                        onChange={(e) =>
                          updateAdSet(i, {
                            destination: { ...set.destination, utmCampaign: e.target.value },
                          })
                        }
                      />
                    </div>
                  </div>
                ))}
                <div className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5">
                  <h3 className="type-caption-strong">Identidade</h3>
                  <PillSelect
                    size="field"
                    className="w-full"
                    value={draft.identity.pageId}
                    onChange={(v) => {
                      const page = boot.pages.find((p) => p.id === v);
                      setDraft((d) => ({
                        ...d,
                        identity: {
                          pageId: v,
                          instagramActorId: page?.instagramId || d.identity.instagramActorId,
                        },
                      }));
                    }}
                    options={boot.pages.map((p) => ({
                      value: p.id,
                      label: p.name || p.id,
                    }))}
                  />
                  {boot.instagram.length > 0 ? (
                    <PillSelect
                      size="field"
                      className="w-full"
                      value={draft.identity.instagramActorId || ""}
                      onChange={(v) =>
                        setDraft((d) => ({
                          ...d,
                          identity: { ...d.identity, instagramActorId: v || undefined },
                        }))
                      }
                      options={[
                        { value: "", label: "Sem Instagram" },
                        ...boot.instagram.map((ig) => ({
                          value: ig.id,
                          label: ig.name || ig.id,
                        })),
                      ]}
                    />
                  ) : null}
                </div>
              </section>
            )}

            {step === 4 && (
              <section className="space-y-4">
                {draft.adSets.map((set, si) => (
                  <div key={set.localKey} className="space-y-3">
                    <h3 className="type-caption-strong">{set.name}</h3>
                    {set.ads.map((ad, ai) => {
                      const ctype = ad.creative.type || "IMAGE";
                      const patchCreative = (patch: Partial<typeof ad.creative>) => {
                        const ads = set.ads.map((a, k) =>
                          k === ai ? { ...a, creative: { ...a.creative, ...patch } } : a,
                        );
                        updateAdSet(si, { ads });
                      };
                      return (
                        <div
                          key={ad.localKey}
                          className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5"
                        >
                          <input
                            className={fieldClass}
                            value={ad.name}
                            onChange={(e) => {
                              const ads = set.ads.map((a, k) =>
                                k === ai ? { ...a, name: e.target.value } : a,
                              );
                              updateAdSet(si, { ads });
                            }}
                          />
                          <PillSelect
                            size="field"
                            className="w-full"
                            value={ctype}
                            onChange={(v) => {
                              const type = v as typeof ad.creative.type;
                              patchCreative({
                                type,
                                ...(type === "CAROUSEL" && !(ad.creative.carouselCards?.length)
                                  ? {
                                      carouselCards: [
                                        { imageHash: "" },
                                        { imageHash: "" },
                                      ],
                                    }
                                  : {}),
                              });
                            }}
                            options={[
                              { value: "IMAGE", label: "Imagem" },
                              { value: "VIDEO", label: "Vídeo" },
                              { value: "CAROUSEL", label: "Carrossel" },
                              { value: "EXISTING_POST", label: "Post existente" },
                            ]}
                          />

                          {ctype === "IMAGE" ? (
                            <div className="grid gap-3 sm:grid-cols-2">
                              <div className="space-y-2 rounded-xl border border-[var(--hairline)] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="type-fine-print">Feed · 1:1</p>
                                  <span className="type-micro-legal text-[var(--ink-muted-48)]">
                                    quadrado
                                  </span>
                                </div>
                                <div className="mx-auto aspect-square w-full max-w-[140px] rounded-lg border border-dashed border-[var(--hairline)] bg-[var(--canvas-parchment)]" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadStaticAspect(si, ai, f, "1:1");
                                    e.target.value = "";
                                  }}
                                />
                                {ad.creative.imageHashSquare || ad.creative.imageHash ? (
                                  <p className="type-micro-legal text-emerald-700">
                                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                                    1:1 pronto
                                  </p>
                                ) : (
                                  <p className="type-micro-legal text-[var(--ink-muted-48)]">
                                    Crop automático ao centro
                                  </p>
                                )}
                              </div>
                              <div className="space-y-2 rounded-xl border border-[var(--hairline)] p-3">
                                <div className="flex items-center justify-between gap-2">
                                  <p className="type-fine-print">Stories / Reels · 9:16</p>
                                  <span className="type-micro-legal text-[var(--ink-muted-48)]">
                                    vertical
                                  </span>
                                </div>
                                <div className="mx-auto aspect-[9/16] h-36 rounded-lg border border-dashed border-[var(--hairline)] bg-[var(--canvas-parchment)]" />
                                <input
                                  type="file"
                                  accept="image/*"
                                  onChange={(e) => {
                                    const f = e.target.files?.[0];
                                    if (f) void uploadStaticAspect(si, ai, f, "9:16");
                                    e.target.value = "";
                                  }}
                                />
                                {ad.creative.imageHashVertical ? (
                                  <p className="type-micro-legal text-emerald-700">
                                    <CheckCircle2 className="mr-1 inline h-3 w-3" />
                                    9:16 pronto
                                  </p>
                                ) : (
                                  <p className="type-micro-legal text-[var(--ink-muted-48)]">
                                    Crop automático ao centro
                                  </p>
                                )}
                              </div>
                            </div>
                          ) : null}

                          {ctype === "VIDEO" ? (
                            <div className="space-y-2">
                              <input
                                className={fieldClass}
                                placeholder="URL pública do vídeo (https://…)"
                                value={videoUrlDraft[ad.localKey] || ""}
                                onChange={(e) =>
                                  setVideoUrlDraft((m) => ({
                                    ...m,
                                    [ad.localKey]: e.target.value,
                                  }))
                                }
                              />
                              <Button
                                type="button"
                                variant="outline"
                                disabled={busy || !videoUrlDraft[ad.localKey]?.trim()}
                                onClick={() =>
                                  void uploadVideo(si, ai, videoUrlDraft[ad.localKey] || "")
                                }
                              >
                                Enviar vídeo à Meta
                              </Button>
                              {ad.creative.videoId ? (
                                <p className="type-micro-legal text-emerald-700">
                                  <CheckCircle2 className="mr-1 inline h-3 w-3" />
                                  video_id: {ad.creative.videoId}
                                </p>
                              ) : null}
                            </div>
                          ) : null}

                          {ctype === "CAROUSEL" ? (
                            <div className="space-y-3">
                              {(ad.creative.carouselCards || []).map((card, ci) => (
                                <div
                                  key={ci}
                                  className="space-y-2 rounded-xl border border-[var(--hairline)] p-3"
                                >
                                  <p className="type-micro-legal text-[var(--ink-muted-48)]">
                                    Card {ci + 1}
                                  </p>
                                  <input
                                    type="file"
                                    accept="image/*"
                                    onChange={(e) => {
                                      const f = e.target.files?.[0];
                                      if (f) void uploadCarouselCard(si, ai, ci, f);
                                    }}
                                  />
                                  {card.imageHash ? (
                                    <p className="type-micro-legal text-emerald-700">
                                      hash: {card.imageHash.slice(0, 10)}…
                                    </p>
                                  ) : null}
                                  <input
                                    className={fieldClass}
                                    placeholder="Título do card"
                                    value={card.headline || ""}
                                    onChange={(e) => {
                                      const cards = [...(ad.creative.carouselCards || [])];
                                      cards[ci] = { ...cards[ci]!, headline: e.target.value };
                                      patchCreative({ carouselCards: cards });
                                    }}
                                  />
                                </div>
                              ))}
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => {
                                  const cards = [
                                    ...(ad.creative.carouselCards || []),
                                    { imageHash: "" },
                                  ];
                                  patchCreative({ carouselCards: cards });
                                }}
                              >
                                <Plus className="mr-1 h-4 w-4" /> Card
                              </Button>
                            </div>
                          ) : null}

                          {ctype === "EXISTING_POST" ? (
                            <input
                              className={fieldClass}
                              placeholder="object_story_id (ex.: 123456_789012)"
                              value={ad.creative.objectStoryId || ""}
                              onChange={(e) =>
                                patchCreative({ objectStoryId: e.target.value })
                              }
                            />
                          ) : null}

                          {ctype !== "EXISTING_POST" ? (
                            <>
                              <textarea
                                className={`${fieldClass} h-24 rounded-2xl py-3`}
                                placeholder="Texto principal"
                                value={ad.creative.primaryText}
                                onChange={(e) => patchCreative({ primaryText: e.target.value })}
                              />
                              <input
                                className={fieldClass}
                                placeholder="Título"
                                value={ad.creative.headline || ""}
                                onChange={(e) => patchCreative({ headline: e.target.value })}
                              />
                              <PillSelect
                                size="field"
                                className="w-full"
                                value={ad.creative.callToAction}
                                onChange={(v) => patchCreative({ callToAction: v })}
                                options={(objCfg?.ctas || []).map((c) => ({
                                  value: c.value,
                                  label: c.label,
                                }))}
                              />
                            </>
                          ) : null}
                        </div>
                      );
                    })}
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => {
                        const ads = [
                          ...set.ads,
                          {
                            ...emptyAd(),
                            name: `Anúncio ${String(set.ads.length + 1).padStart(2, "0")}`,
                          },
                        ];
                        updateAdSet(si, { ads });
                      }}
                    >
                      <Plus className="mr-1 h-4 w-4" /> Novo criativo
                    </Button>
                  </div>
                ))}
              </section>
            )}

            {step === 5 && (
              <section className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5">
                <h3 className="type-caption-strong">Revisão</h3>
                <pre className="overflow-auto rounded-lg bg-[var(--canvas-parchment)] p-3 type-micro-legal text-[var(--ink-muted-80)]">
                  {JSON.stringify(
                    {
                      campaign: draft.campaign,
                      account: draft.account,
                      identity: draft.identity,
                      adSets: draft.adSets.map((s) => ({
                        name: s.name,
                        budget: s.budget,
                        optimizationGoal: s.optimizationGoal,
                        ads: s.ads.map((a) => a.name),
                      })),
                    },
                    null,
                    2,
                  )}
                </pre>
                {issues.length > 0 ? (
                  <ul className="space-y-1 type-fine-print text-amber-800">
                    {issues.map((iss, i) => (
                      <li key={i}>⚠ {iss.message}</li>
                    ))}
                  </ul>
                ) : (
                  <p className="type-fine-print text-emerald-700">Pronto para validar/publicar.</p>
                )}
                <div className="flex flex-wrap gap-2">
                  <Button type="button" variant="outline" disabled={busy} onClick={() => void validate()}>
                    Validar campanha
                  </Button>
                  <Button type="button" disabled={busy} onClick={() => void publish()}>
                    {busy ? "Publicando…" : "Criar pausada na Meta"}
                  </Button>
                </div>
              </section>
            )}

            {step === 6 && (
              <section className="space-y-3 rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-5">
                <h3 className="type-caption-strong">Publicação</h3>
                {publishResult ? (
                  <>
                    <p className="type-fine-print">
                      Status: <strong>{publishResult.status}</strong>
                    </p>
                    {publishResult.metaCampaignId ? (
                      <p className="type-fine-print">
                        Campaign ID Meta: {publishResult.metaCampaignId}
                      </p>
                    ) : null}
                    {publishResult.error ? (
                      <p className="type-fine-print text-red-700">{publishResult.error}</p>
                    ) : null}
                    <div className="flex flex-wrap gap-2">
                      {publishResult.status === "PARTIAL" || publishResult.status === "FAILED" ? (
                        <Button type="button" disabled={busy} onClick={() => void retry()}>
                          Tentar novamente
                        </Button>
                      ) : null}
                      {publishResult.ok && publishResult.campaignId ? (
                        <>
                          <Button type="button" disabled={busy} onClick={() => void activate()}>
                            Ativar campanha
                          </Button>
                          <Button
                            type="button"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void pauseCampaign()}
                          >
                            Pausar
                          </Button>
                        </>
                      ) : null}
                      <BackLink href="/criar/p/anuncios" />
                    </div>
                  </>
                ) : (
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    Publique na etapa Revisão para ver o resultado.
                  </p>
                )}
              </section>
            )}

            <div className="flex justify-between">
              {step > 0 ? (
                <BackLink onClick={() => setStep((s) => Math.max(0, s - 1))} />
              ) : (
                <span />
              )}
              {step < 5 ? (
                <Button type="button" onClick={() => setStep((s) => Math.min(6, s + 1))}>
                  Continuar
                </Button>
              ) : null}
            </div>
          </div>

          <aside className="h-fit rounded-xl border border-[var(--hairline)] bg-[var(--canvas)] p-4 lg:sticky lg:top-6">
            <h2 className="type-caption-strong text-[var(--ink)]">Resumo</h2>
            <dl className="mt-3 space-y-2 type-fine-print text-[var(--ink-muted-80)]">
              <div>
                <dt className="type-micro-legal text-[var(--ink-muted-48)]">Campanha</dt>
                <dd>{summary.name}</dd>
              </div>
              <div>
                <dt className="type-micro-legal text-[var(--ink-muted-48)]">Objetivo</dt>
                <dd>{summary.objective}</dd>
              </div>
              <div>
                <dt className="type-micro-legal text-[var(--ink-muted-48)]">Orçamento</dt>
                <dd>{summary.budget}</dd>
              </div>
              <div>
                <dt className="type-micro-legal text-[var(--ink-muted-48)]">Anúncios</dt>
                <dd>{summary.ads}</dd>
              </div>
              <div>
                <dt className="type-micro-legal text-[var(--ink-muted-48)]">Status</dt>
                <dd>{summary.status}</dd>
              </div>
            </dl>
          </aside>
        </div>
      )}
    </AppPage>
  );
}
