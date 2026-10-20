"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Monitor, Plus, Smartphone, Trash2, Upload } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import type { StoreBanner } from "@/lib/commerce/banners";
import { cn } from "@/lib/utils";

function emptyBanner(): StoreBanner {
  return {
    id: `banner-${Date.now().toString(36)}`,
    imageUrl: "",
    mobileImageUrl: null,
    href: "",
    active: true,
    sortOrder: 0,
  };
}

export default function CommerceBannersPage() {
  const { workspaceId, isReady } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [banners, setBanners] = useState<StoreBanner[] | null>(null);
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [surface, setSurface] = useState<Record<string, "desktop" | "mobile">>({});
  const fileRefs = useRef<Record<string, HTMLInputElement | null>>({});

  const { data, isLoading, isError, isFetched } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ store: { banners: StoreBanner[] } | null }>;
    },
  });

  useEffect(() => {
    if (data?.store) setBanners(data.store.banners ?? []);
  }, [data]);

  const save = useMutation({
    mutationFn: async () => {
      if (!banners) return;
      const r = await fetch("/api/atrako/commerce/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          banners: banners.map((b, i) => ({ ...b, sortOrder: i })),
        }),
      });
      if (!r.ok) throw new Error("Falha ao salvar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-store", workspaceId] }),
  });

  async function uploadImage(bannerId: string, file: File, target: "desktop" | "mobile") {
    if (!workspaceId) return;
    setUploadingId(`${bannerId}:${target}`);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("file", file);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload falhou");
      const json = (await r.json()) as { url?: string };
      if (!json.url || !banners) return;
      setBanners(
        banners.map((b) =>
          b.id === bannerId
            ? target === "mobile"
              ? { ...b, mobileImageUrl: json.url as string }
              : { ...b, imageUrl: json.url as string }
            : b,
        ),
      );
    } finally {
      setUploadingId(null);
    }
  }

  if (!isReady || (workspaceId && isLoading)) {
    return <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>;
  }
  if (!workspaceId) return null;
  if (isError || (isFetched && !data?.store)) {
    return <p className="type-body">Não foi possível carregar os banners da loja.</p>;
  }
  if (!banners) {
    return <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-tagline text-[var(--ink)]">Banners</h1>
          <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
            Só a imagem no carrossel. O link define para onde o clique leva (produto, página ou URL).
          </p>
          <p className="mt-2 type-caption text-[var(--ink)]">
            Desktop: 1920 × 360 px. Celular: 1080 × 540 px (2:1). Sem arte de celular, a vitrine usa a do desktop.
          </p>
        </div>
        <button
          type="button"
          className={cn(buttonVariants({ variant: "outline" }), "!gap-1.5")}
          onClick={() => setBanners([...banners, { ...emptyBanner(), sortOrder: banners.length }])}
        >
          <Plus className="h-4 w-4" />
          Banner
        </button>
      </div>

      {banners.length === 0 ? (
        <div className="rounded-[var(--radius-xs)] border border-dashed border-[var(--hairline)] bg-white px-4 py-10 text-center">
          <ImagePlus className="mx-auto h-8 w-8 text-[var(--ink-muted-48)]" strokeWidth={1.5} />
          <p className="mt-3 type-body text-[var(--ink-muted-48)]">
            Nenhum banner. Sem imagem, a vitrine não mostra o carrossel.
          </p>
          <p className="mt-2 type-caption text-[var(--ink-muted-48)]">
            Desktop 1920 × 360 px. Celular 1080 × 540 px.
          </p>
        </div>
      ) : (
        <ul className="space-y-4">
          {banners.map((banner, index) => {
            const tab = surface[banner.id] ?? "desktop";
            const preview = tab === "mobile" ? banner.mobileImageUrl : banner.imageUrl;
            const uploading = uploadingId === `${banner.id}:${tab}`;
            return (
            <li
              key={banner.id}
              className="grid gap-4 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4 md:grid-cols-[minmax(18rem,26rem)_1fr]"
            >
              <div className="space-y-2">
                <div className="flex gap-2" role="tablist" aria-label="Onde o banner aparece">
                  {(
                    [
                      ["desktop", Monitor, "Banner no desktop"],
                      ["mobile", Smartphone, "Banner no celular"],
                    ] as const
                  ).map(([value, Icon, label]) => (
                    <button
                      key={value}
                      type="button"
                      role="tab"
                      aria-selected={tab === value}
                      aria-label={label}
                      className={cn(
                        "inline-flex h-11 w-11 items-center justify-center rounded-[var(--radius-xs)] active:scale-95",
                        tab === value
                          ? "border border-[var(--hairline)] bg-white text-[var(--ink)]"
                          : "bg-[var(--canvas)] text-[var(--ink-muted-48)]",
                      )}
                      onClick={() => setSurface((current) => ({ ...current, [banner.id]: value }))}
                    >
                      <Icon className="h-5 w-5" strokeWidth={1.75} />
                    </button>
                  ))}
                </div>
                <div
                  className={cn(
                    "overflow-hidden rounded-[var(--radius-xs)] bg-[var(--canvas)]",
                    tab === "mobile" ? "aspect-[2/1]" : "aspect-[1920/360]",
                  )}
                >
                  {preview ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={preview} alt="" className="h-full w-full object-cover" />
                  ) : (
                    <div className="flex h-full items-center justify-center type-fine-print text-[var(--ink-muted-48)]">
                      Sem imagem
                    </div>
                  )}
                </div>
                <input
                  ref={(el) => {
                    fileRefs.current[`${banner.id}:${tab}`] = el;
                  }}
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  className="hidden"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void uploadImage(banner.id, file, tab);
                    e.target.value = "";
                  }}
                />
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline" }), "w-full !gap-1.5")}
                  disabled={uploading}
                  onClick={() => fileRefs.current[`${banner.id}:${tab}`]?.click()}
                >
                  <Upload className="h-4 w-4" />
                  {uploading ? "Enviando…" : "Enviar imagem"}
                </button>
                <p className="type-fine-print text-[var(--ink-muted-48)]">
                  {tab === "mobile" ? "1080 × 540 px · 2:1. JPG, PNG ou WebP." : "1920 × 360 px. JPG, PNG ou WebP."}
                </p>
              </div>

              <div className="grid gap-3">
                <label className="space-y-1">
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    {tab === "mobile" ? "URL da imagem no celular" : "URL da imagem no desktop"}
                  </span>
                  <input
                    className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
                    value={tab === "mobile" ? banner.mobileImageUrl ?? "" : banner.imageUrl}
                    onChange={(e) => {
                      const next = [...banners];
                      next[index] =
                        tab === "mobile"
                          ? { ...banner, mobileImageUrl: e.target.value || null }
                          : { ...banner, imageUrl: e.target.value };
                      setBanners(next);
                    }}
                    placeholder="https://… ou upload"
                  />
                </label>
                <label className="space-y-1">
                  <span className="type-fine-print text-[var(--ink-muted-48)]">
                    Link ao clicar
                  </span>
                  <input
                    className="h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
                    value={banner.href ?? ""}
                    onChange={(e) => {
                      const next = [...banners];
                      next[index] = { ...banner, href: e.target.value };
                      setBanners(next);
                    }}
                    placeholder="/loja/draxx/p/meu-produto ou https://…"
                  />
                </label>
                <div className="flex items-center justify-between gap-3">
                  <label className="flex items-center gap-2">
                    <Switch
                      checked={banner.active}
                      onChange={(checked) => {
                        const next = [...banners];
                        next[index] = { ...banner, active: checked };
                        setBanners(next);
                      }}
                    />
                    <span className="type-body">Ativo na vitrine</span>
                  </label>
                  <button
                    type="button"
                    className="p-2 text-[var(--ink-muted-48)]"
                    aria-label="Remover banner"
                    onClick={() => setBanners(banners.filter((_, i) => i !== index))}
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              </div>
            </li>
            );
          })}
        </ul>
      )}

      <button
        type="button"
        className={cn(buttonVariants({ variant: "primary" }))}
        disabled={save.isPending}
        onClick={() => save.mutate()}
      >
        {save.isPending ? "Salvando…" : "Salvar banners"}
      </button>
      {save.isSuccess ? <p className="type-caption text-[var(--success)]">Salvo.</p> : null}
    </div>
  );
}
