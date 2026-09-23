"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Plus } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";
import { Button } from "@/components/ui/button";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import {
  WEEKDAY_LABELS,
  brl,
  type AgendaProfessional,
  type AgendaService,
  type AvailabilityRule,
} from "@/components/agenda/agenda-shared";

const fieldClass =
  "mt-1 h-11 w-full rounded-[var(--radius-xs)] border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] px-4 type-caption text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]";

const STEPS = ["pagina", "servicos", "horarios", "profissionais", "publicar"] as const;
type Step = (typeof STEPS)[number];

const DEFAULT_RULES: AvailabilityRule[] = [1, 2, 3, 4, 5].map((dayOfWeek) => ({
  dayOfWeek,
  startTime: "09:00",
  endTime: "18:00",
}));

function CriarAgendaInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const qc = useQueryClient();
  const mode = searchParams.get("mode") === "ai" ? "ai" : "manual";

  const [step, setStep] = useState<Step>("pagina");
  const [pageId, setPageId] = useState<string | null>(null);
  const [pageTitle, setPageTitle] = useState("Agenda");
  const [pageSlug, setPageSlug] = useState("agenda");
  const [pageDescription, setPageDescription] = useState("");
  const [services, setServices] = useState<AgendaService[]>([]);
  const [svcTitle, setSvcTitle] = useState("");
  const [svcDuration, setSvcDuration] = useState("60");
  const [svcPrice, setSvcPrice] = useState("");
  const [hours, setHours] = useState<AvailabilityRule[]>(
    [0, 1, 2, 3, 4, 5, 6].map((day) => {
      const d = DEFAULT_RULES.find((r) => r.dayOfWeek === day);
      return d ?? { dayOfWeek: day, startTime: "", endTime: "" };
    }),
  );
  const [pros, setPros] = useState<AgendaProfessional[]>([]);
  const [proName, setProName] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { workspaceId, workspaces, isLoading: loadingClientes } = useActiveWorkspace();
  const workspaceSlug = workspaces.find((w) => w.id === workspaceId)?.slug;

  const { data: meta } = useQuery({
    queryKey: ["agenda-meta", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(
        `/api/atrako/agenda/meta?workspaceId=${encodeURIComponent(workspaceId!)}`,
      );
      if (!r.ok) return { businessMode: "SOLO" as const };
      const j = await r.json();
      return {
        businessMode: j.businessMode === "SALON" ? ("SALON" as const) : ("SOLO" as const),
      };
    },
  });
  const salon = meta?.businessMode === "SALON";

  const visibleSteps = useMemo(
    () => (salon ? STEPS : STEPS.filter((s) => s !== "profissionais")),
    [salon],
  );
  const stepIndex = visibleSteps.indexOf(step);

  useEffect(() => {
    if (!workspaceId) return;
    (async () => {
      try {
        const r = await fetch(
          `/api/atrako/agenda/pages?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        if (!r.ok) return;
        const pages = (await r.json()) as Array<{
          id: string;
          title: string;
          slug: string;
          description?: string | null;
          isDefault?: boolean;
        }>;
        const def =
          pages.find((p) => p.isDefault) || pages[0] || null;
        if (def) {
          setPageId(def.id);
          setPageTitle(def.title);
          setPageSlug(def.slug);
          setPageDescription(def.description || "");
        }
        const sr = await fetch(
          `/api/atrako/agenda/services?workspaceId=${encodeURIComponent(workspaceId)}`,
        );
        if (sr.ok) {
          const list = await sr.json();
          setServices(Array.isArray(list) ? list : list.services ?? []);
        }
      } catch {
        /* ignore bootstrap */
      }
    })();
  }, [workspaceId]);

  async function ensurePage(): Promise<string> {
    if (!workspaceId) throw new Error("Workspace obrigatório");
    if (pageId) {
      await fetch(`/api/atrako/agenda/pages/${pageId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: pageTitle.trim() || "Agenda",
          slug: pageSlug.trim() || "agenda",
          description: pageDescription.trim() || null,
        }),
      });
      return pageId;
    }
    const r = await fetch("/api/atrako/agenda/pages", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        workspaceId,
        title: pageTitle.trim() || "Agenda",
        description: pageDescription.trim() || undefined,
      }),
    });
    const j = await r.json();
    if (!r.ok) throw new Error(j.error || "Erro ao criar página");
    setPageId(j.id);
    if (j.slug) setPageSlug(j.slug);
    return j.id as string;
  }

  async function savePageStep() {
    setSaving(true);
    setError(null);
    try {
      await ensurePage();
      setStep("servicos");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function addService(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !svcTitle.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const priceCents =
        Math.round(Number(svcPrice.replace(",", ".")) * 100) || 0;
      const r = await fetch("/api/atrako/agenda/services", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          title: svcTitle.trim(),
          durationMinutes: Math.max(15, Number(svcDuration) || 60),
          priceCents,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao criar serviço");
      setServices((prev) => [...prev, j]);
      setSvcTitle("");
      setSvcPrice("");
      setSvcDuration("60");
      qc.invalidateQueries({ queryKey: ["agenda-services", workspaceId] });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function saveHoursStep() {
    if (!workspaceId) return;
    setSaving(true);
    setError(null);
    try {
      const id = await ensurePage();
      const rules = hours.filter((h) => h.startTime && h.endTime);
      const r = await fetch("/api/atrako/agenda/availability", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          bookingPageId: id,
          rules,
        }),
      });
      if (!r.ok) {
        const j = await r.json().catch(() => ({}));
        throw new Error(j.error || "Erro ao salvar horários");
      }
      setStep(salon ? "profissionais" : "publicar");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  async function loadPros() {
    if (!workspaceId || !salon) return;
    const r = await fetch(
      `/api/atrako/agenda/professionals?workspaceId=${encodeURIComponent(workspaceId)}`,
    );
    if (!r.ok) return;
    const list = await r.json();
    setPros(Array.isArray(list) ? list : []);
  }

  useEffect(() => {
    if (step === "profissionais") void loadPros();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step, workspaceId, salon]);

  async function addPro(e: React.FormEvent) {
    e.preventDefault();
    if (!workspaceId || !proName.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const r = await fetch("/api/atrako/agenda/professionals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          displayName: proName.trim(),
          serviceIds: services.map((s) => s.id),
          copyHoursFromPageId: pageId || undefined,
        }),
      });
      const j = await r.json();
      if (!r.ok) throw new Error(j.error || "Erro ao criar profissional");
      setProName("");
      await loadPros();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Erro");
    } finally {
      setSaving(false);
    }
  }

  function publish() {
    const slug = workspaceSlug || "";
    const page = pageSlug || "agenda";
    router.push(
      `/criar/sucesso?kind=agenda&slug=${encodeURIComponent(slug)}&page=${encodeURIComponent(page)}&name=${encodeURIComponent(pageTitle.trim() || "Agenda")}`,
    );
  }

  function goBack() {
    const i = visibleSteps.indexOf(step);
    if (i <= 0) {
      router.push(`/criar/p/agenda?mode=${mode}`);
      return;
    }
    setStep(visibleSteps[i - 1]);
  }

  if (loadingClientes) {
    return (
      <AppPage title="Agenda">
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      </AppPage>
    );
  }

  if (!workspaceId) {
    return (
      <AppPage title="Agenda">
        <BackLink href="/criar/p/agenda" />
        <p className="mt-6 type-body text-[var(--ink-muted-80)]">
          Crie uma empresa em Config antes de publicar a agenda.
        </p>
      </AppPage>
    );
  }

  const hasPaidService = services.some((s) => s.priceCents > 0);

  return (
    <AppPage title="Publicar agenda">
      <BackLink href={`/criar/p/agenda?mode=${mode}`} />

      <ol className="mt-4 flex flex-wrap gap-2">
        {visibleSteps.map((s, i) => (
          <li
            key={s}
            className={`rounded-[var(--radius-xs)] px-3 py-1.5 type-fine-print ${
              i === stepIndex
                ? "bg-[var(--primary)] text-[var(--on-primary)]"
                : i < stepIndex
                  ? "bg-[var(--canvas-parchment)] text-[var(--ink)]"
                  : "text-[var(--ink-muted-48)]"
            }`}
          >
            {s === "pagina"
              ? "Página"
              : s === "servicos"
                ? "Serviços"
                : s === "horarios"
                  ? "Horários"
                  : s === "profissionais"
                    ? "Equipe"
                    : "Publicar"}
          </li>
        ))}
      </ol>

      {error ? (
        <p className="mt-4 type-caption text-[var(--destructive,#b91c1c)]">{error}</p>
      ) : null}

      {step === "pagina" ? (
        <form
          className="mt-6 max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void savePageStep();
          }}
        >
          <div>
            <label className="type-fine-print text-[var(--ink-muted-80)]">Título</label>
            <input
              className={fieldClass}
              value={pageTitle}
              onChange={(e) => setPageTitle(e.target.value)}
              required
            />
          </div>
          <div>
            <label className="type-fine-print text-[var(--ink-muted-80)]">Slug público</label>
            <input
              className={fieldClass}
              value={pageSlug}
              onChange={(e) =>
                setPageSlug(
                  e.target.value
                    .toLowerCase()
                    .replace(/[^a-z0-9-]/g, "-"),
                )
              }
              required
            />
            <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
              /b/{workspaceSlug || "…"}/{pageSlug || "agenda"}
            </p>
          </div>
          <div>
            <label className="type-fine-print text-[var(--ink-muted-80)]">Descrição</label>
            <textarea
              className={`${fieldClass} min-h-[88px] py-3`}
              value={pageDescription}
              onChange={(e) => setPageDescription(e.target.value)}
            />
          </div>
          <div className="flex gap-2">
            <Button type="button" variant="pearl" onClick={goBack}>
              Voltar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "servicos" ? (
        <div className="mt-6 max-w-lg space-y-6">
          <ul className="divide-y divide-[var(--divider-soft)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
            {services.length === 0 ? (
              <li className="px-4 py-6 type-caption text-[var(--ink-muted-48)]">
                Nenhum serviço ainda.
              </li>
            ) : (
              services.map((s) => (
                <li key={s.id} className="flex justify-between px-4 py-3 type-body">
                  <span>
                    {s.title}
                    <span className="ml-2 type-fine-print text-[var(--ink-muted-48)]">
                      {s.durationMinutes} min
                    </span>
                  </span>
                  <span className="type-caption-strong">{brl(s.priceCents)}</span>
                </li>
              ))
            )}
          </ul>
          <form className="space-y-3" onSubmit={addService}>
            <p className="type-nav-link">Adicionar serviço</p>
            <input
              className={fieldClass}
              placeholder="Nome"
              value={svcTitle}
              onChange={(e) => setSvcTitle(e.target.value)}
              required
            />
            <div className="grid grid-cols-2 gap-3">
              <input
                className={fieldClass}
                placeholder="Duração (min)"
                value={svcDuration}
                onChange={(e) => setSvcDuration(e.target.value)}
              />
              <input
                className={fieldClass}
                placeholder="Preço (R$)"
                value={svcPrice}
                onChange={(e) => setSvcPrice(e.target.value)}
              />
            </div>
            <Button type="submit" variant="secondary-pill" disabled={saving}>
              <Plus className="h-4 w-4" /> Adicionar
            </Button>
          </form>
          <div className="flex gap-2">
            <Button type="button" variant="pearl" onClick={goBack}>
              Voltar
            </Button>
            <Button
              type="button"
              disabled={services.length === 0}
              onClick={() => setStep("horarios")}
            >
              Continuar
            </Button>
          </div>
        </div>
      ) : null}

      {step === "horarios" ? (
        <form
          className="mt-6 max-w-lg space-y-4"
          onSubmit={(e) => {
            e.preventDefault();
            void saveHoursStep();
          }}
        >
          <p className="type-body text-[var(--ink-muted-80)]">
            Defina os dias e horários em que a agenda recebe reservas.
          </p>
          <ul className="space-y-2">
            {hours.map((row) => (
              <li
                key={row.dayOfWeek}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-2"
              >
                <span className="type-caption">{WEEKDAY_LABELS[row.dayOfWeek]}</span>
                <input
                  type="time"
                  className={fieldClass}
                  value={row.startTime}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((h) =>
                        h.dayOfWeek === row.dayOfWeek
                          ? { ...h, startTime: e.target.value }
                          : h,
                      ),
                    )
                  }
                />
                <input
                  type="time"
                  className={fieldClass}
                  value={row.endTime}
                  onChange={(e) =>
                    setHours((prev) =>
                      prev.map((h) =>
                        h.dayOfWeek === row.dayOfWeek
                          ? { ...h, endTime: e.target.value }
                          : h,
                      ),
                    )
                  }
                />
              </li>
            ))}
          </ul>
          <div className="flex gap-2">
            <Button type="button" variant="pearl" onClick={goBack}>
              Voltar
            </Button>
            <Button type="submit" disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : "Continuar"}
            </Button>
          </div>
        </form>
      ) : null}

      {step === "profissionais" && salon ? (
        <div className="mt-6 max-w-lg space-y-6">
          <ul className="divide-y divide-[var(--divider-soft)] rounded-[var(--radius-xs)] border border-[var(--hairline)]">
            {pros.length === 0 ? (
              <li className="px-4 py-6 type-caption text-[var(--ink-muted-48)]">
                Nenhum profissional. Adicione a equipe ou continue.
              </li>
            ) : (
              pros.map((p) => (
                <li key={p.id} className="px-4 py-3 type-body">
                  {p.displayName}
                </li>
              ))
            )}
          </ul>
          <form className="flex gap-2" onSubmit={addPro}>
            <input
              className={fieldClass}
              placeholder="Nome do profissional"
              value={proName}
              onChange={(e) => setProName(e.target.value)}
            />
            <Button type="submit" variant="secondary-pill" disabled={saving}>
              <Plus className="h-4 w-4" />
            </Button>
          </form>
          <div className="flex gap-2">
            <Button type="button" variant="pearl" onClick={goBack}>
              Voltar
            </Button>
            <Button type="button" onClick={() => setStep("publicar")}>
              Continuar
            </Button>
          </div>
        </div>
      ) : null}

      {step === "publicar" ? (
        <div className="mt-6 max-w-lg space-y-4">
          <p className="type-body text-[var(--ink)]">
            Pronto para publicar{" "}
            <strong className="font-semibold">{pageTitle || "Agenda"}</strong> com{" "}
            {services.length} serviço{services.length === 1 ? "" : "s"}.
          </p>
          <p className="type-caption text-[var(--ink-muted-80)]">
            Link público: /b/{workspaceSlug}/{pageSlug}
          </p>
          {hasPaidService ? (
            <p className="type-caption text-[var(--ink-muted-80)]">
              Serviços pagos usam Mercado Pago em{" "}
              <a href="/config/conexoes" className="text-[var(--primary)] underline">
                Config → Conexões
              </a>
              .
            </p>
          ) : null}
          <div className="flex gap-2">
            <Button type="button" variant="pearl" onClick={goBack}>
              Voltar
            </Button>
            <Button type="button" onClick={publish}>
              Publicar
            </Button>
          </div>
        </div>
      ) : null}
    </AppPage>
  );
}

export default function CriarAgendaPage() {
  return (
    <Suspense
      fallback={
        <div className="flex justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <CriarAgendaInner />
    </Suspense>
  );
}
