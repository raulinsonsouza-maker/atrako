"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { Button, Switch, TextField } from "@/components/ui";

type Photo = { src: string; alt: string };
type Property = {
  id: string;
  slug: string;
  name: string;
  headline: string | null;
  story: string | null;
  concept: string | null;
  photos: Photo[];
  nightlyCents: number;
  cleaningFeeCents: number;
  minNights: number;
  maxNights: number;
  checkInTime: string;
  checkOutTime: string;
  published: boolean;
  heroFrameCount: number;
};

function reais(cents: number) {
  return (cents / 100).toFixed(2);
}

function cents(value: string) {
  const n = Number(value.replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return null;
  return Math.round(n * 100);
}

export default function StayPropertyPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [form, setForm] = useState<Property | null>(null);
  const [nightly, setNightly] = useState("");
  const [cleaning, setCleaning] = useState("");
  const [error, setError] = useState("");
  const [copied, setCopied] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ["stay-property", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const res = await fetch(`/api/atrako/stay?workspaceId=${workspaceId}`);
      if (!res.ok) throw new Error("Falha ao carregar o imóvel");
      return res.json() as Promise<{ property: Property | null }>;
    },
  });

  useEffect(() => {
    if (!data?.property) return;
    setForm(data.property);
    setNightly(reais(data.property.nightlyCents));
    setCleaning(reais(data.property.cleaningFeeCents));
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!form) return;
      const nightlyCents = cents(nightly);
      const cleaningFeeCents = cents(cleaning);
      if (nightlyCents == null || cleaningFeeCents == null) throw new Error("Informe os valores em reais.");
      const res = await fetch("/api/atrako/stay", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          name: form.name,
          headline: form.headline ?? "",
          story: form.story ?? "",
          concept: form.concept ?? "",
          nightlyCents,
          cleaningFeeCents,
          minNights: form.minNights,
          maxNights: form.maxNights,
          checkInTime: form.checkInTime,
          checkOutTime: form.checkOutTime,
          published: form.published,
          photos: form.photos,
          heroFrameCount: form.heroFrameCount,
        }),
      });
      const body = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(body.error || "Não foi possível salvar");
    },
    onSuccess: () => {
      setError("");
      queryClient.invalidateQueries({ queryKey: ["stay-property", workspaceId] });
    },
    onError: (err) => setError(err instanceof Error ? err.message : "Não foi possível salvar"),
  });

  async function upload(file: File) {
    if (!form || !workspaceId) return;
    const body = new FormData();
    body.set("workspaceId", workspaceId);
    body.set("file", file);
    const res = await fetch("/api/atrako/stay/photo", { method: "POST", body });
    const json = (await res.json().catch(() => ({}))) as { url?: string; error?: string };
    if (!res.ok || !json.url) {
      setError(json.error || "Não foi possível enviar a foto");
      return;
    }
    setForm({ ...form, heroFrameCount: 0, photos: [...form.photos, { src: json.url, alt: form.name }] });
  }

  const link = form ? `${typeof window === "undefined" ? "" : window.location.origin}/estadia/${form.slug}` : "";

  return (
    <section>
      <h1 className="type-tagline">Imóvel</h1>
      <p className="type-body mt-2 text-[var(--ink-muted-80)]">O texto, o preço e as fotos que o hóspede vê na página pública.</p>
      {isLoading || (data?.property && !form) ? <p className="type-body mt-6">Carregando…</p> : !form ? (
        <p className="type-body mt-6">Não foi possível carregar o imóvel.</p>
      ) : (
        <form
          className="mt-6 grid gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            save.mutate();
          }}
        >
          <div className="flex flex-wrap items-center justify-between gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] p-4">
            <p className="type-caption break-all">{link}</p>
            <Button
              type="button"
              variant="outline"
              onClick={async () => {
                await navigator.clipboard.writeText(link);
                setCopied(true);
              }}
            >
              {copied ? "Link copiado" : "Copiar link"}
            </Button>
          </div>
          <TextField label="Nome" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          <TextField label="Manchete" value={form.headline ?? ""} onChange={(e) => setForm({ ...form, headline: e.target.value })} />
          <TextField label="Conceito" value={form.concept ?? ""} onChange={(e) => setForm({ ...form, concept: e.target.value })} />
          <label className="block">
            <span className="type-caption-strong">História</span>
            <textarea
              value={form.story ?? ""}
              onChange={(e) => setForm({ ...form, story: e.target.value })}
              rows={5}
              className="mt-2 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-5 py-3 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
            />
          </label>
          <div className="grid gap-4 sm:grid-cols-2">
            <TextField label="Diária (R$)" value={nightly} onChange={(e) => setNightly(e.target.value)} />
            <TextField label="Taxa de limpeza (R$)" value={cleaning} onChange={(e) => setCleaning(e.target.value)} />
            <TextField label="Mínimo de noites" type="number" min={1} value={String(form.minNights)} onChange={(e) => setForm({ ...form, minNights: Number(e.target.value) })} />
            <TextField label="Máximo de noites" type="number" min={1} value={String(form.maxNights)} onChange={(e) => setForm({ ...form, maxNights: Number(e.target.value) })} />
            <TextField label="Check-in" value={form.checkInTime} onChange={(e) => setForm({ ...form, checkInTime: e.target.value })} />
            <TextField label="Check-out" value={form.checkOutTime} onChange={(e) => setForm({ ...form, checkOutTime: e.target.value })} />
          </div>
          <label className="flex items-center gap-3">
            <Switch checked={form.published} aria-label="Página publicada" onChange={(published) => setForm({ ...form, published })} />
            <span className="type-body">{form.published ? "Página publicada" : "Página oculta"}</span>
          </label>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
            {form.photos.map((photo) => (
              <figure key={photo.src} className="overflow-hidden rounded-[var(--radius-xs)] border border-[var(--hairline)]">
                <img src={photo.src} alt={photo.alt} className="aspect-[4/3] w-full object-cover" />
                <button
                  type="button"
                  className="type-caption w-full px-2 py-2 text-left"
                  onClick={() => setForm({ ...form, photos: form.photos.filter((item) => item.src !== photo.src) })}
                >
                  Remover
                </button>
              </figure>
            ))}
          </div>
          <label className="type-caption-strong">
            Enviar foto
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              className="mt-2 block type-body"
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) void upload(file);
                event.target.value = "";
              }}
            />
          </label>
          {error ? <p className="type-caption">{error}</p> : null}
          <div>
            <Button type="submit" disabled={save.isPending}>{save.isPending ? "Salvando…" : "Salvar imóvel"}</Button>
          </div>
        </form>
      )}
    </section>
  );
}
