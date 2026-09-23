"use client";

import { Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import type { Data } from "@puckeditor/core";
import "@puckeditor/core/puck.css";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";
import { UrlPreview } from "@/components/criar/CopyLinkButton";
import { LpPagesList } from "@/components/criar/LpPagesList";
import {
  LpCreateModal,
  type LpCreateStep,
} from "@/components/criar/LpCreateModal";
import {
  firstCheckoutProductIdFromPuck,
  firstFormIdFromPuck,
  puckHasBlockType,
  puckHasUnresolvedCheckout,
} from "@/lib/criar/puck/puck-checkout";
import { slugify } from "@/lib/criar/slug";
import type { LpGoal, LpSalesPageV2 } from "@/lib/criar/lp-schema";
import { isLpSalesPageV1, isLpSalesPageV2 } from "@/lib/criar/lp-schema";
import type {
  LpFormCatalogItem,
  LpPuckProduct,
} from "@/lib/criar/puck/context";
import {
  buildEmptyPuck,
  buildTemplatePuck,
  getTemplateMeta,
  seedPuckFromBrief,
  type LpTemplateId,
} from "@/lib/criar/puck/templates";

const PuckLpEditor = dynamic(
  () =>
    import("@/components/criar/PuckLpEditor").then((m) => m.PuckLpEditor),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-1 items-center justify-center bg-[var(--canvas)]">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    ),
  },
);

type Mode = "manual" | "ai";

function OfertaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const modeParam = searchParams.get("mode");
  const mode: Mode | null =
    modeParam === "manual" || modeParam === "ai" ? modeParam : null;
  const via = mode === "ai" ? "assistente" : "manual";
  const focus = searchParams.get("focus");

  const [goal, setGoal] = useState<LpGoal | null>(null);
  const [brief, setBrief] = useState("");
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [slug, setSlug] = useState("");
  const [slugTouched, setSlugTouched] = useState(false);
  const [puckData, setPuckData] = useState<Data | null>(null);
  const [deliverableLabel, setDeliverableLabel] = useState("Acesso ao produto");
  const [deliverableUrl, setDeliverableUrl] = useState("");
  const [saving, setSaving] = useState(false);
  const [saveState, setSaveState] = useState<
    "idle" | "dirty" | "saving" | "saved" | "error"
  >("idle");
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [createStep, setCreateStep] = useState<LpCreateStep | "closed">(
    "closed",
  );
  const [draftProductId, setDraftProductId] = useState<string | null>(null);
  const [pageStatus, setPageStatus] = useState<"DRAFT" | "PUBLISHED">("DRAFT");
  /** Legado: form/checkout só em salesPage (páginas antigas). */
  const [legacyFormId, setLegacyFormId] = useState("");
  const [legacyCheckoutProductId, setLegacyCheckoutProductId] = useState("");
  const [extraCheckouts, setExtraCheckouts] = useState<LpPuckProduct[]>([]);
  const [extraForms, setExtraForms] = useState<LpFormCatalogItem[]>([]);

  const saveGenRef = useRef(0);
  const draftIdRef = useRef<string | null>(null);
  const saveInFlightRef = useRef<Promise<string | null> | null>(null);
  draftIdRef.current = draftProductId;

  const productIdParam = searchParams.get("productId");
  const wantEdit = searchParams.get("edit") === "1";
  const forceNew = searchParams.get("new") === "1";
  const entryParam = searchParams.get("entry");
  const filterParam = searchParams.get("filter");
  const templateParam = searchParams.get("template");

  useEffect(() => {
    if (!mode) router.replace("/criar/oferta?mode=manual");
  }, [mode, router]);

  /** Abrir detalhe GreatPages quando só há productId (sem edit). */
  useEffect(() => {
    if (mode === "manual" && productIdParam && !wantEdit && !editing) {
      router.replace(`/criar/paginas/${encodeURIComponent(productIdParam)}`);
    }
  }, [mode, productIdParam, wantEdit, editing, router]);

  useEffect(() => {
    if (mode !== "manual" || editing || wantEdit || productIdParam || goal) {
      return;
    }
    if (templateParam) {
      const meta = getTemplateMeta(templateParam as LpTemplateId);
      if (meta) {
        startWithTemplate(templateParam as LpTemplateId, meta.goal);
      }
      return;
    }
    if (entryParam === "template" || focus === "checkout") {
      setCreateStep("template");
      return;
    }
    if (forceNew || focus === "page" || focus === "leads") {
      setCreateStep("entry");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [mode, forceNew, focus, entryParam, templateParam, productIdParam, wantEdit]);

  const { data: clientes = [] } = useQuery({
    queryKey: ["config-clientes"],
    queryFn: async () => {
      const r = await fetch("/api/clientes");
      if (!r.ok) return [];
      const j = await r.json();
      return Array.isArray(j) ? j : j.clientes ?? [];
    },
  });
  const workspaceId = clientes[0]?.id as string | undefined;
  const brandName = (clientes[0]?.nome as string | undefined) || "Sua marca";

  const { data: commerce, isLoading: loadingPages } = useQuery({
    queryKey: ["commerce-data", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok)
        return {
          products: [] as Array<{
            id: string;
            name: string;
            slug: string;
            priceCents: number;
            status: string;
            visits?: number;
            conversions?: number;
            salesPage?: unknown;
          }>,
        };
      return r.json() as Promise<{
        products: Array<{
          id: string;
          name: string;
          slug: string;
          priceCents: number;
          status: string;
          visits?: number;
          conversions?: number;
          salesPage?: unknown;
        }>;
      }>;
    },
    enabled: Boolean(workspaceId) && !editing,
  });
  const pages = useMemo(() => {
    const all = commerce?.products ?? [];
    return all.filter(
      (p) => isLpSalesPageV2(p.salesPage) || isLpSalesPageV1(p.salesPage),
    );
  }, [commerce?.products]);

  const { data: captureForms = [] } = useQuery({
    queryKey: ["capture-forms", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/forms?workspaceId=${workspaceId}`);
      if (!r.ok)
        return [] as Array<{
          id: string;
          name: string;
          slug: string;
          status: string;
        }>;
      const j = (await r.json()) as {
        forms?: Array<{
          id: string;
          name: string;
          slug: string;
          status: string;
        }>;
      };
      return (j.forms ?? []).filter((f) => f.status === "PUBLISHED");
    },
    enabled: Boolean(workspaceId) && editing,
  });

  const { data: checkoutProducts = [] } = useQuery({
    queryKey: ["commerce-checkouts", workspaceId],
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce?workspaceId=${workspaceId}`);
      if (!r.ok) {
        return [] as Array<{
          id: string;
          name: string;
          slug: string;
          priceCents: number;
          type: string;
          status: string;
        }>;
      }
      const j = (await r.json()) as {
        products?: Array<{
          id: string;
          name: string;
          slug: string;
          priceCents: number;
          type?: string;
          status?: string;
        }>;
      };
      return (j.products ?? []).filter(
        (p) => p.status === "PUBLISHED" && p.priceCents > 0,
      );
    },
    enabled: Boolean(workspaceId) && editing,
  });

  const formCatalog = useMemo(() => {
    const map = new Map<string, LpFormCatalogItem>();
    for (const f of captureForms) {
      map.set(f.id, { id: f.id, name: f.name || f.slug, slug: f.slug });
    }
    for (const f of extraForms) map.set(f.id, f);
    return [...map.values()];
  }, [captureForms, extraForms]);

  const formSlugForEditor = useMemo(() => {
    const fromBlock = firstFormIdFromPuck(puckData);
    const id = fromBlock || legacyFormId;
    if (!id) return null;
    return formCatalog.find((x) => x.id === id)?.slug ?? null;
  }, [puckData, legacyFormId, formCatalog]);

  const checkoutCatalog = useMemo(() => {
    const map = new Map<string, LpPuckProduct>();
    for (const p of checkoutProducts) {
      map.set(p.id, {
        id: p.id,
        name: p.name,
        slug: p.slug,
        priceCents: p.priceCents,
        description: null,
        clienteId: workspaceId || "",
        type: p.type,
      });
    }
    for (const p of extraCheckouts) map.set(p.id, p);
    return [...map.values()];
  }, [checkoutProducts, extraCheckouts, workspaceId]);

  const syncedCheckoutProductId = useMemo(
    () =>
      firstCheckoutProductIdFromPuck(puckData) ||
      legacyCheckoutProductId ||
      "",
    [puckData, legacyCheckoutProductId],
  );

  const onCheckoutCreated = useCallback((product: LpPuckProduct) => {
    setExtraCheckouts((prev) => {
      if (prev.some((p) => p.id === product.id)) return prev;
      return [...prev, product];
    });
    setSaveState("dirty");
  }, []);

  const onFormCreated = useCallback((form: LpFormCatalogItem) => {
    setExtraForms((prev) => {
      if (prev.some((f) => f.id === form.id)) return prev;
      return [...prev, form];
    });
    setSaveState("dirty");
  }, []);

  /** Carregar página existente no studio (Editar design). */
  useEffect(() => {
    if (!wantEdit || !productIdParam || !workspaceId || editing || mode !== "manual") {
      return;
    }
    let cancelled = false;
    void (async () => {
      try {
        const r = await fetch(
          `/api/atrako/commerce?workspaceId=${workspaceId}`,
        );
        if (!r.ok) return;
        const j = (await r.json()) as {
          products: Array<{
            id: string;
            name: string;
            slug: string;
            priceCents: number;
            status?: string;
            salesPage?: unknown;
          }>;
        };
        const product = j.products?.find((p) => p.id === productIdParam);
        if (!product || cancelled) return;
        const { isLpSalesPageV2 } = await import("@/lib/criar/lp-schema");
        const sales = product.salesPage;
        setDraftProductId(product.id);
        setPageStatus(
          product.status === "PUBLISHED" ? "PUBLISHED" : "DRAFT",
        );
        if (isLpSalesPageV2(sales)) {
          setGoal(sales.goal);
          setPuckData(sales.puck as Data);
          setName(product.name);
          setSlug(product.slug);
          setSlugTouched(true);
          setLegacyFormId(typeof sales.formId === "string" ? sales.formId : "");
          setLegacyCheckoutProductId(
            typeof sales.checkoutProductId === "string" &&
              sales.checkoutProductId
              ? sales.checkoutProductId
              : sales.goal === "sales" && product.priceCents > 0
                ? product.id
                : "",
          );
          if (sales.goal === "sales" && product.priceCents > 0) {
            setPrice(
              (product.priceCents / 100).toFixed(2).replace(".", ","),
            );
          }
          setSaveState("saved");
          setEditing(true);
        } else {
          startWithGoal(product.priceCents > 0 ? "sales" : "leads");
          setName(product.name);
          setSlug(product.slug);
          setSlugTouched(true);
        }
      } catch {
        /* ignore */
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [wantEdit, productIdParam, workspaceId, mode]);

  const autoSlug = useMemo(() => slugify(name || "oferta"), [name]);
  const effectiveSlug = slugTouched && slug ? slugify(slug) : autoSlug;
  const path = `/p/${effectiveSlug}`;

  const priceCents = useMemo(() => {
    const n = Number(price.replace(",", "."));
    if (!Number.isFinite(n) || n <= 0) return 0;
    return Math.round(n * 100);
  }, [price]);

  function startWithGoal(g: LpGoal) {
    const fallback: LpTemplateId =
      g === "leads" ? "captura-saas" : "oferta-digital";
    startWithTemplate(fallback, g);
  }

  function startBlank() {
    setGoal("leads");
    setCreateStep("closed");
    setPuckData(buildEmptyPuck());
    setName("Página sem título");
    setSlug("");
    setSlugTouched(false);
    setDraftProductId(null);
    draftIdRef.current = null;
    setPageStatus("DRAFT");
    setSaveState("idle");
    setLegacyFormId("");
    setLegacyCheckoutProductId("");
    setExtraCheckouts([]);
    setExtraForms([]);
    setEditing(true);
    setError(null);
  }

  function startWithTemplate(templateId: LpTemplateId, g: LpGoal) {
    setGoal(g);
    setCreateStep("closed");
    if (mode === "manual") {
      const data = buildTemplatePuck(templateId);
      setPuckData(data);
      const hero = data.content.find((c) => c.type === "Hero");
      if (hero && hero.type === "Hero") {
        setName(String(hero.props.title || ""));
      }
      if (g === "sales") setPrice("97");
      setDraftProductId(null);
      draftIdRef.current = null;
      setPageStatus("DRAFT");
      setSaveState("idle");
      setLegacyFormId("");
      setLegacyCheckoutProductId("");
      setExtraCheckouts([]);
      setExtraForms([]);
      setEditing(true);
    }
  }

  function resetStudio() {
    setEditing(false);
    setGoal(null);
    setPuckData(null);
    setShowExtras(false);
    setError(null);
    setCreateStep("closed");
    setDraftProductId(null);
    setPageStatus("DRAFT");
    setSaveState("idle");
    setLegacyFormId("");
    setLegacyCheckoutProductId("");
    setExtraCheckouts([]);
    setExtraForms([]);
  }

  function applyAi() {
    if (!goal || !brief.trim()) return;
    const seeded = seedPuckFromBrief(goal, brief);
    setName(seeded.name);
    setPuckData(seeded.puck);
    if (seeded.priceCents > 0) {
      setPrice((seeded.priceCents / 100).toFixed(2).replace(".", ","));
    } else if (goal === "sales") {
      setPrice("97");
    }
    setEditing(true);
  }

  const buildPagePayload = useCallback((): LpSalesPageV2 | null => {
    if (!puckData || !goal) return null;
    const hasCheckout = puckHasBlockType(puckData, "AtrakoCheckout");
    const formId =
      firstFormIdFromPuck(puckData) ||
      (legacyFormId.trim() ? legacyFormId.trim() : undefined);
    const checkoutProductId =
      firstCheckoutProductIdFromPuck(puckData) ||
      ((hasCheckout || goal === "sales") && legacyCheckoutProductId.trim()
        ? legacyCheckoutProductId.trim()
        : undefined);
    return {
      version: 2,
      goal,
      puck: puckData,
      formId: formId || undefined,
      checkoutProductId: checkoutProductId || undefined,
      deliverable:
        (goal === "sales" || hasCheckout) && deliverableUrl.trim()
          ? {
              kind: "url",
              label: deliverableLabel.trim() || "Acesso ao produto",
              value: deliverableUrl.trim(),
            }
          : undefined,
    };
  }, [
    puckData,
    goal,
    legacyFormId,
    legacyCheckoutProductId,
    deliverableUrl,
    deliverableLabel,
  ]);

  const persistPage = useCallback(
    async (opts: { status: "DRAFT" | "PUBLISHED"; quiet?: boolean }) => {
      if (saveInFlightRef.current) {
        await saveInFlightRef.current;
      }

      const run = (async (): Promise<string | null> => {
        if (!workspaceId) {
          if (!opts.quiet) {
            setError("Crie uma empresa em Config antes de salvar.");
          }
          return null;
        }
        const pageName = name.trim() || "Página sem título";
        const pagePayload = buildPagePayload();
        if (!pagePayload) {
          if (!opts.quiet) setError("Escolha o objetivo e edite a página.");
          return null;
        }
        const hasCheckoutBlock = puckHasBlockType(puckData, "AtrakoCheckout");
        if (
          opts.status === "PUBLISHED" &&
          puckHasUnresolvedCheckout(puckData) &&
          !legacyCheckoutProductId.trim()
        ) {
          if (!opts.quiet) {
            setError(
              "Escolha o que cobrar no bloco Checkout (sidebar do editor).",
            );
          }
          return null;
        }
        if (
          opts.status === "PUBLISHED" &&
          goal === "sales" &&
          hasCheckoutBlock &&
          !pagePayload.checkoutProductId
        ) {
          if (!opts.quiet) {
            setError(
              "Escolha o que cobrar no bloco Checkout (sidebar do editor).",
            );
          }
          return null;
        }

        const selectedCheckout = checkoutCatalog.find(
          (p) => p.id === syncedCheckoutProductId,
        );
        const sellPriceCents =
          selectedCheckout?.priceCents ??
          (goal === "sales" ? priceCents : 0);

        const gen = ++saveGenRef.current;
        if (opts.quiet) setSaveState("saving");
        else {
          setSaving(true);
          setError(null);
        }

        try {
          const r = await fetch("/api/atrako/commerce", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              workspaceId,
              action: "product",
              productId: draftIdRef.current || undefined,
              name: pageName,
              slug: effectiveSlug,
              priceCents: goal === "sales" ? sellPriceCents : 0,
              description: undefined,
              status: opts.status,
              salesPage: pagePayload,
            }),
          });
          const j = await r.json();
          if (!r.ok) throw new Error(j.error || "Não foi possível salvar.");
          if (gen !== saveGenRef.current) return j.product?.id ?? null;

          const id = typeof j.product?.id === "string" ? j.product.id : null;
          if (id) {
            setDraftProductId(id);
            draftIdRef.current = id;
            if (!productIdParam || productIdParam !== id) {
              const params = new URLSearchParams(searchParams.toString());
              params.set("mode", mode || "manual");
              params.set("edit", "1");
              params.set("productId", id);
              params.delete("new");
              router.replace(`/criar/oferta?${params.toString()}`, {
                scroll: false,
              });
            }
          }
          setPageStatus(opts.status);
          if (opts.quiet) setSaveState("saved");
          return id;
        } catch (err) {
          if (gen !== saveGenRef.current) return null;
          const msg = err instanceof Error ? err.message : "Falha ao salvar";
          if (opts.quiet) setSaveState("error");
          else setError(msg);
          return null;
        } finally {
          if (!opts.quiet) setSaving(false);
        }
      })();

      saveInFlightRef.current = run.finally(() => {
        if (saveInFlightRef.current === run) saveInFlightRef.current = null;
      });
      return run;
    },
    [
      workspaceId,
      name,
      buildPagePayload,
      goal,
      priceCents,
      syncedCheckoutProductId,
      checkoutCatalog,
      legacyCheckoutProductId,
      effectiveSlug,
      productIdParam,
      searchParams,
      mode,
      router,
      puckData,
    ],
  );

  /** Autosave após pausa na edição (~1,2s). */
  useEffect(() => {
    if (!editing || !puckData || !goal || !workspaceId) return;
    if (!name.trim() && !draftIdRef.current) return;

    setSaveState((s) => (s === "saving" ? s : "dirty"));
    const t = window.setTimeout(() => {
      void persistPage({ status: pageStatus, quiet: true });
    }, 1200);
    return () => window.clearTimeout(t);
  }, [
    editing,
    puckData,
    goal,
    workspaceId,
    name,
    priceCents,
    effectiveSlug,
    deliverableLabel,
    deliverableUrl,
    legacyFormId,
    legacyCheckoutProductId,
    pageStatus,
    persistPage,
  ]);

  async function publish() {
    if (!name.trim()) {
      setError("Informe o nome da oferta.");
      return;
    }
    const id = await persistPage({ status: "PUBLISHED", quiet: false });
    if (!id) return;
    router.push(
      `/criar/sucesso?kind=oferta&slug=${encodeURIComponent(effectiveSlug)}&id=${encodeURIComponent(id)}&name=${encodeURIComponent(name.trim())}`,
    );
  }

  if (!mode) {
    return (
      <div className="flex flex-1 items-center justify-center py-20">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const backHref = via === "assistente" ? "/criar?assistente=1" : "/criar";
  const pageTitle = "Minhas páginas";
  const goalLabel = goal === "leads" ? "Leads" : goal === "sales" ? "Vendas" : null;
  const templateFilter =
    filterParam === "leads" || filterParam === "sales"
      ? filterParam
      : focus === "checkout"
        ? "sales"
        : focus === "leads"
          ? "leads"
          : "all";
  const inStudio = Boolean(goal && editing && puckData);

  const studioProduct = useMemo(
    () => ({
      id: draftProductId || "preview",
      name: name || "Oferta",
      slug: effectiveSlug,
      priceCents,
      description: null as string | null,
      clienteId: workspaceId || "",
    }),
    [draftProductId, name, effectiveSlug, priceCents, workspaceId],
  );

  const studioCheckoutProduct = useMemo(() => {
    if (!syncedCheckoutProductId || !workspaceId) return null;
    const p = checkoutCatalog.find((c) => c.id === syncedCheckoutProductId);
    return p ?? null;
  }, [checkoutCatalog, syncedCheckoutProductId, workspaceId]);

  if (inStudio && puckData && goal) {
    return (
      <div className="lp-studio">
        {showExtras ? (
          <div className="lp-studio-panel">
            <div className="lp-studio-panel-head">
              <div>
                <p className="type-caption-strong text-[var(--ink)]">
                  Dados da página
                </p>
                <p className="type-micro-legal text-[var(--ink-muted-48)]">
                  Nome e URL
                </p>
              </div>
            </div>

            <div className="lp-studio-panel-grid" data-cols="2">
              <label className="lp-studio-field">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Nome da página
                </span>
                <input
                  className="type-caption"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Ex.: Mentoria 30 dias"
                  required
                />
              </label>
              <label className="lp-studio-field">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Slug da URL
                </span>
                <input
                  className="type-caption"
                  value={slugTouched ? slug : effectiveSlug}
                  onChange={(e) => {
                    setSlugTouched(true);
                    setSlug(e.target.value);
                  }}
                />
              </label>
              <div className="lp-studio-field" style={{ gridColumn: "1 / -1" }}>
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  URL pública
                </span>
                <UrlPreview path={path} className="lp-studio-url-chip" />
              </div>
              <label className="lp-studio-field">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  Entregável (rótulo)
                </span>
                <input
                  className="type-caption"
                  value={deliverableLabel}
                  onChange={(e) => setDeliverableLabel(e.target.value)}
                />
              </label>
              <label className="lp-studio-field">
                <span className="type-micro-legal text-[var(--ink-muted-48)]">
                  URL do entregável
                </span>
                <input
                  className="type-caption"
                  value={deliverableUrl}
                  onChange={(e) => setDeliverableUrl(e.target.value)}
                  placeholder="https://…"
                  type="url"
                />
              </label>
            </div>

            <div className="lp-studio-panel-foot">
              <p className="type-micro-legal text-[var(--ink-muted-48)]">
                {via === "assistente" ? "Assistente" : "Manual"} · {pageTitle}
              </p>
              <button
                type="button"
                className="lp-pages-btn-secondary"
                onClick={resetStudio}
              >
                Recomeçar
              </button>
            </div>
          </div>
        ) : null}

        {error ? (
          <p className="lp-studio-error type-caption text-[var(--danger)]">
            {error}
          </p>
        ) : null}

        <div className="lp-studio-stage">
          <PuckLpEditor
            goal={goal}
            data={puckData}
            onChange={setPuckData}
            pageTitle={name.trim() || pageTitle}
            pageName={name}
            onPageNameChange={setName}
            path={path}
            goalLabel={goalLabel}
            backHref={backHref}
            saving={saving}
            saveState={saveState}
            canPublish={Boolean(workspaceId)}
            onPublish={() => void publish()}
            onToggleExtras={() => setShowExtras((v) => !v)}
            extrasOpen={showExtras}
            onOpenPreview={() =>
              window.open(path, "_blank", "noopener,noreferrer")
            }
            product={studioProduct}
            brandName={brandName}
            checkoutProduct={studioCheckoutProduct}
            checkoutCatalog={checkoutCatalog}
            formSlug={formSlugForEditor}
            formCatalog={formCatalog}
            onCheckoutCreated={onCheckoutCreated}
            onFormCreated={onFormCreated}
          />
        </div>
      </div>
    );
  }

  return (
    <AppPage title={null} className="overflow-y-auto">
      {loadingPages ? (
        <div className="mt-8 flex items-center gap-2 type-caption text-[var(--ink-muted-48)]">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />{" "}
          Carregando páginas…
        </div>
      ) : null}

      {!goal && !loadingPages ? (
        <>
          <LpPagesList
            pages={pages}
            onAdd={() => setCreateStep("entry")}
            leadingAction={<BackLink href={backHref} />}
          />

          <LpCreateModal
            open={createStep !== "closed"}
            step={createStep === "closed" ? "entry" : createStep}
            onStepChange={(s) => setCreateStep(s)}
            onClose={() => setCreateStep("closed")}
            onSelectTemplate={startWithTemplate}
            onStartBlank={startBlank}
            onStartAi={(g) => {
              setGoal(g);
              setBrief("");
            }}
            templateFilter={templateFilter}
          />
        </>
      ) : null}

      {goal && !editing && !puckData ? (
        <div className="mt-4 max-w-xl space-y-3">
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Objetivo: {goal === "leads" ? "Leads" : "Vendas"}
          </p>
          <label className="block">
            <span className="type-micro-legal text-[var(--ink-muted-48)]">
              Descreva a oferta
            </span>
            <textarea
              value={brief}
              onChange={(e) => setBrief(e.target.value)}
              rows={5}
              placeholder="Ex.: Mentoria de 30 dias para clínicas, R$ 497…"
              className="mt-1 w-full rounded-lg border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 py-3 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
              autoFocus
            />
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              className="lp-pages-btn-primary"
              onClick={applyAi}
              disabled={!brief.trim()}
            >
              Gerar estrutura
            </button>
            <button
              type="button"
              className="lp-pages-btn-secondary"
              onClick={() => setCreateStep("entry")}
            >
              Outro caminho
            </button>
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}

export default function CriarOfertaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <OfertaInner />
    </Suspense>
  );
}
