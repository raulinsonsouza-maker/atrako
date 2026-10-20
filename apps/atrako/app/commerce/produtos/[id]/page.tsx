"use client";

import { use, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Bold, GripVertical, ImagePlus, Italic, List, Trash2, Underline } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";
import { buttonVariants } from "@/components/ui/button";
import { PillSelect } from "@/components/ui/pill-select";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import type { ProductBadges } from "@/lib/commerce/badges";
import { cn } from "@/lib/utils";

type Variant = {
  id: string;
  sku: string | null;
  options: Record<string, string>;
  priceCents: number | null;
  stockQty: number;
  active: boolean;
};

type ProductImage = { src: string; alt?: string; kind?: "image" | "video" };

type Product = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  priceCents: number;
  status: string;
  active: boolean;
  stockTracked: boolean;
  coverUrl: string | null;
  images: unknown;
  categoryId: string | null;
  badges?: ProductBadges | unknown;
  variants: Variant[];
};

type ProductSummary = {
  code: string;
  stockQty: number | null;
  soldQty: number;
  recentOrders: { id: string; createdAt: string; status: string; quantity: number; totalCents: number }[];
};

type Category = { id: string; name: string };

function orderStatusLabel(status: string) {
  if (status === "APPROVED") return "Pago";
  if (status === "PENDING") return "Pendente";
  if (status === "CANCELLED" || status === "CANCELED") return "Cancelado";
  if (status === "REFUNDED") return "Estornado";
  return status;
}

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function centsFromInput(value: string) {
  const n = Number(value.replace(/\./g, "").replace(",", "."));
  if (!Number.isFinite(n) || n < 0) return 0;
  return Math.round(n * 100);
}

function reaisInput(cents: number) {
  return (cents / 100).toFixed(2).replace(".", ",");
}

function asImages(raw: unknown): ProductImage[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((row) => {
    if (!row || typeof row !== "object") return [];
    const src = (row as { src?: unknown }).src;
    const kind = (row as { kind?: unknown }).kind === "video" ? "video" : "image";
    return typeof src === "string" && src.trim() ? [{ src, kind }] : [];
  });
}

function galleryKey(list: ProductImage[]) {
  return list.map((img) => `${img.kind ?? "image"}:${img.src}`).join("|");
}

function Section({ title, hint, children }: { title: string; hint?: string; children: React.ReactNode }) {
  return (
    <section className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4">
      <div>
        <h2 className="type-body-strong text-[var(--ink)]">{title}</h2>
        {hint ? <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">{hint}</p> : null}
      </div>
      {children}
    </section>
  );
}

const fieldClass =
  "h-11 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body";

export default function CommerceProductDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { workspaceId, isReady } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const uploadTarget = useRef<"cover" | "gallery">("cover");
  const [uploading, setUploading] = useState(false);

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [description, setDescription] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [stockTracked, setStockTracked] = useState(false);
  const [active, setActive] = useState(true);
  const [featured, setFeatured] = useState(false);
  const [launch, setLaunch] = useState(false);
  const [extraBadge, setExtraBadge] = useState("");
  const [htmlMode, setHtmlMode] = useState(false);
  const [fontSize, setFontSize] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);
  const [hydratedId, setHydratedId] = useState("");

  const [optKey, setOptKey] = useState("Tamanho");
  const [optVal, setOptVal] = useState("");
  const [stockQty, setStockQty] = useState("10");
  const [sku, setSku] = useState("");
  const [variantPrice, setVariantPrice] = useState("");
  const [galleryOverride, setGalleryOverride] = useState<ProductImage[] | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-catalog", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/catalog?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        products: Product[];
        categories: Category[];
        summary: ProductSummary | null;
      }>;
    },
  });

  const { data: summaryData } = useQuery({
    queryKey: ["commerce-product-summary", workspaceId, id],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/catalog?workspaceId=${workspaceId}&productId=${id}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ summary: ProductSummary | null }>;
    },
  });

  const { data: storeData } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ store: { slug: string; publicUrl: string } | null }>;
    },
  });

  const product = data?.products.find((p) => p.id === id);
  const serverGallery = asImages(product?.images);
  if (galleryOverride && galleryKey(galleryOverride) === galleryKey(serverGallery)) {
    setGalleryOverride(null);
  }
  const gallery = galleryOverride ?? serverGallery;

  useEffect(() => {
    if (!product || hydratedId === product.id) return;
    setName(product.name);
    setSlug(product.slug);
    setDescription(product.description ?? "");
    setPrice(reaisInput(product.priceCents));
    setCategoryId(product.categoryId ?? "");
    setStockTracked(product.stockTracked);
    setActive(product.active);
    const badges = product.badges && typeof product.badges === "object" ? (product.badges as ProductBadges) : null;
    setFeatured(badges?.featured === true);
    setLaunch(badges?.launch === true);
    setExtraBadge(badges?.extra ?? "");
    setHydratedId(product.id);
    if (editorRef.current && document.activeElement !== editorRef.current) {
      editorRef.current.innerHTML = product.description ?? "";
    }
  }, [product, hydratedId]);

  const wasHtmlMode = useRef(false);
  useEffect(() => {
    if (wasHtmlMode.current && !htmlMode && editorRef.current) {
      editorRef.current.innerHTML = description;
    }
    wasHtmlMode.current = htmlMode;
  }, [htmlMode, description]);

  function applyFontSize(px: string) {
    const editor = editorRef.current;
    if (!editor || !px) return;
    editor.focus();
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0 || !editor.contains(sel.anchorNode)) return;
    const range = sel.getRangeAt(0);
    if (range.collapsed) return;
    const span = document.createElement("span");
    span.style.fontSize = `${px}px`;
    try {
      range.surroundContents(span);
    } catch {
      span.appendChild(range.extractContents());
      range.insertNode(span);
    }
    setDescription(editor.innerHTML);
  }

  const save = useMutation({
    mutationFn: async (patch: Record<string, unknown>) => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "product", id, ...patch }),
      });
      if (!r.ok) {
        const body = (await r.json().catch(() => ({}))) as { error?: string };
        throw new Error(body.error || "Falha ao salvar");
      }
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] }),
  });

  function commitGallery(next: ProductImage[]) {
    setGalleryOverride(next);
    save.mutate({ images: next }, { onError: () => setGalleryOverride(null) });
  }

  const addVariant = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "variant",
          productId: id,
          sku: sku || null,
          options: optVal.trim() ? { [optKey || "Opção"]: optVal.trim() } : {},
          stockQty: Math.max(0, Number(stockQty) || 0),
          priceCents: variantPrice.trim() ? centsFromInput(variantPrice) : null,
        }),
      });
      if (!r.ok) throw new Error("Falha ao criar variante");
    },
    onSuccess: () => {
      setOptVal("");
      setSku("");
      setVariantPrice("");
      queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] });
    },
  });

  const patchVariant = useMutation({
    mutationFn: async (payload: { id: string } & Record<string, unknown>) => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "variant", ...payload }),
      });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] }),
  });

  async function upload(file: File) {
    if (!workspaceId || !product) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("file", file);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload falhou");
      const json = (await r.json()) as { url?: string };
      if (!json.url) return;
      const video = file.type.startsWith("video/");
      if (uploadTarget.current === "cover") {
        if (video) return;
        save.mutate({ coverUrl: json.url });
      } else {
        commitGallery([
          ...gallery,
          { src: json.url, kind: video ? "video" : "image" },
        ]);
      }
    } finally {
      setUploading(false);
    }
  }

  if (!isReady || isLoading) {
    return <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>;
  }
  if (!workspaceId) return null;
  if (!product) {
    return (
      <div>
        <BackLink href="/commerce/produtos">Produtos</BackLink>
        <p className="mt-4 type-body">Produto não encontrado.</p>
      </div>
    );
  }

  const storeSlug = storeData?.store?.slug;
  const publicHref = storeSlug ? `/loja/${storeSlug}/p/${product.slug}` : null;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <BackLink href="/commerce/produtos">Produtos</BackLink>
          <h1 className="mt-2 type-tagline text-[var(--ink)]">Editar produto</h1>
          <p className="mt-1 type-caption text-[var(--ink-muted-48)]">{product.name}</p>
        </div>
        <div className="flex items-center gap-3">
          {save.isError ? <p className="type-caption text-[var(--primary)]">{save.error.message}</p> : null}
          {save.isSuccess ? <p className="type-caption text-[var(--success)]">Salvo.</p> : null}
          <button
            type="button"
            className={cn(buttonVariants({ variant: "primary" }))}
            disabled={save.isPending || !name.trim()}
            onClick={() =>
              save.mutate({
                name,
                slug,
                description,
                priceCents: centsFromInput(price),
                categoryId: categoryId || null,
                stockTracked,
                active,
                badges: { featured, launch, extra: extraBadge },
              })
            }
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      <section className="grid gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-4 sm:grid-cols-4">
        {(
          [
            ["Código", summaryData?.summary?.code ?? product.slug],
            [
              "Estoque atual",
              summaryData?.summary?.stockQty == null ? "Sem controle" : String(summaryData.summary.stockQty),
            ],
            ["Quantidade vendida", String(summaryData?.summary?.soldQty ?? 0)],
            [
              "Últimos 10 pedidos",
              summaryData?.summary?.recentOrders.length
                ? String(summaryData.summary.recentOrders.length)
                : "Sem informação",
            ],
          ] as const
        ).map(([label, value]) => (
          <div key={label}>
            <p className="type-fine-print text-[var(--ink-muted-48)]">{label}</p>
            <p className="type-body-strong">{value}</p>
          </div>
        ))}
        {summaryData?.summary?.recentOrders.length ? (
          <ul className="space-y-1 border-t border-[var(--hairline)] pt-3 sm:col-span-4">
            {summaryData.summary.recentOrders.map((order) => (
              <li key={order.id} className="flex items-center justify-between gap-3 type-caption">
                <span>
                  {new Date(order.createdAt).toLocaleDateString("pt-BR")} · {orderStatusLabel(order.status)}
                </span>
                <span>
                  {order.quantity} un. · {brl(order.totalCents)}
                </span>
              </li>
            ))}
          </ul>
        ) : null}
      </section>

      <div className="grid items-start gap-4 xl:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="min-w-0 space-y-4">
      <Section title="Nome do produto" hint="Como aparece na vitrine e na busca.">
        <input className={fieldClass} value={name} onChange={(e) => setName(e.target.value)} />
      </Section>

      <Section title="Imagens e vídeo" hint="A capa é uma imagem. Arraste as fotos da galeria para mudar a ordem. Vídeos: MP4 ou WebM, até 20 MB.">
        <input
          ref={fileRef}
          type="file"
          accept="image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) void upload(file);
            e.target.value = "";
          }}
        />
        <div className="flex flex-wrap gap-3">
          <button
            type="button"
            className="flex h-28 w-28 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]"
            onClick={() => {
              uploadTarget.current = "cover";
              if (fileRef.current) {
                fileRef.current.accept = "image/png,image/jpeg,image/webp,image/gif";
                fileRef.current.click();
              }
            }}
          >
            {product.coverUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={product.coverUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="type-fine-print text-[var(--ink-muted-48)]">Capa</span>
            )}
          </button>
          {gallery.map((img, index) => (
            <div
              key={`${img.kind ?? "image"}:${img.src}`}
              draggable
              tabIndex={0}
              aria-label={`Posição ${index + 1}. Arraste para reordenar`}
              onDragStart={(e) => {
                e.dataTransfer.effectAllowed = "move";
                e.dataTransfer.setData("text/plain", String(index));
                e.currentTarget.style.opacity = "0.4";
              }}
              onDragOver={(e) => {
                e.preventDefault();
                e.dataTransfer.dropEffect = "move";
              }}
              onDrop={(e) => {
                e.preventDefault();
                const from = Number(e.dataTransfer.getData("text/plain"));
                e.currentTarget.style.opacity = "";
                if (!Number.isInteger(from) || from < 0 || from === index) return;
                const next = [...gallery];
                const [item] = next.splice(from, 1);
                if (!item) return;
                next.splice(index, 0, item);
                commitGallery(next);
              }}
              onDragEnd={(e) => {
                e.currentTarget.style.opacity = "";
              }}
              className="relative h-28 w-28 cursor-grab active:cursor-grabbing"
            >
              {img.kind === "video" ? (
                <video
                  src={img.src}
                  muted
                  playsInline
                  preload="metadata"
                  draggable={false}
                  className="pointer-events-none h-full w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] object-cover"
                />
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={img.src}
                  alt=""
                  draggable={false}
                  className="pointer-events-none h-full w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] object-cover"
                />
              )}
              <span className="pointer-events-none absolute bottom-1 left-1 rounded-[var(--radius-xs)] bg-white p-0.5 text-[var(--ink)]">
                <GripVertical className="h-3.5 w-3.5" strokeWidth={1.75} aria-hidden />
              </span>
              <button
                type="button"
                draggable={false}
                className="absolute right-1 top-1 rounded-[var(--radius-xs)] bg-white p-1"
                aria-label="Remover imagem"
                onMouseDown={(e) => e.stopPropagation()}
                onClick={() => commitGallery(gallery.filter((g) => g.src !== img.src))}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>
          ))}
          <button
            type="button"
            disabled={uploading}
            className="flex h-28 w-28 flex-col items-center justify-center gap-1 rounded-[var(--radius-xs)] border border-dashed border-[var(--hairline)] text-[var(--ink-muted-48)]"
            onClick={() => {
              uploadTarget.current = "gallery";
              if (fileRef.current) {
                fileRef.current.accept = "image/png,image/jpeg,image/webp,image/gif,video/mp4,video/webm";
                fileRef.current.click();
              }
            }}
          >
            <ImagePlus className="h-5 w-5" strokeWidth={1.5} />
            <span className="type-fine-print">{uploading ? "Enviando…" : "Adicionar"}</span>
          </button>
        </div>
      </Section>

      <Section title="Descrição" hint="Formatação básica ou HTML. O que for salvo aparece na página do produto.">
        <div className="flex flex-wrap items-center gap-1">
          {(
            [
              ["bold", Bold, "Negrito"],
              ["italic", Italic, "Itálico"],
              ["underline", Underline, "Sublinhado"],
              ["insertUnorderedList", List, "Lista"],
            ] as const
          ).map(([command, Icon, label]) => (
            <button
              key={command}
              type="button"
              className="inline-flex h-9 items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-fine-print"
              aria-label={label}
              onMouseDown={(e) => e.preventDefault()}
              onClick={() => {
                editorRef.current?.focus();
                document.execCommand(command);
                setDescription(editorRef.current?.innerHTML ?? "");
              }}
            >
              <Icon className="h-3.5 w-3.5" strokeWidth={1.75} />
              {label}
            </button>
          ))}
          <button
            type="button"
            className="inline-flex h-9 items-center rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-fine-print"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => {
              editorRef.current?.focus();
              document.execCommand("formatBlock", false, "h3");
              setDescription(editorRef.current?.innerHTML ?? "");
            }}
          >
            Título
          </button>
          <PillSelect
            value={fontSize}
            onChange={(value) => {
              setFontSize("");
              applyFontSize(value);
            }}
            aria-label="Tamanho"
            options={[
              { value: "", label: "Tamanho" },
              { value: "14", label: "14" },
              { value: "16", label: "16" },
              { value: "18", label: "18" },
              { value: "24", label: "24" },
            ]}
          />
          <button
            type="button"
            className="ml-auto inline-flex h-9 items-center rounded-[var(--radius-xs)] border border-[var(--hairline)] px-2 type-fine-print"
            onClick={() => {
              if (!htmlMode) setDescription(editorRef.current?.innerHTML ?? description);
              setHtmlMode((v) => !v);
            }}
          >
            {htmlMode ? "Visual" : "HTML"}
          </button>
        </div>
        {htmlMode ? (
          <textarea
            className="min-h-36 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-3 type-body"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        ) : (
          <div
            ref={editorRef}
            className="store-html min-h-36 w-full rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-3 type-body outline-none"
            contentEditable
            suppressContentEditableWarning
            onInput={(e) => setDescription((e.target as HTMLDivElement).innerHTML)}
          />
        )}
      </Section>

      <Section title="Preço" hint="Preço de vitrine. A variação pode ter um preço próprio.">
        <label className="block max-w-xs space-y-1">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Preço (R$)</span>
          <input className={fieldClass} value={price} onChange={(e) => setPrice(e.target.value)} inputMode="decimal" />
        </label>
      </Section>

      <Section title="Estoque" hint="Com controle ligado, a vitrine respeita a quantidade de cada variação.">
        <label className="flex items-center gap-2">
          <Switch checked={stockTracked} onChange={setStockTracked} />
          <span className="type-body">Controlar estoque</span>
        </label>
      </Section>
      </div>

      <div className="min-w-0 space-y-4">
      <Section title="Produto ativo" hint="Oculto some da vitrine. À venda aparece no catálogo.">
        <label className="flex items-center gap-2">
          <Switch
            checked={active}
            onChange={(checked) => {
              setActive(checked);
              save.mutate({ active: checked });
            }}
          />
          <span className="type-body">{active ? "À venda" : "Oculto"}</span>
        </label>
      </Section>

      <Section
        title="Apresentação"
        hint="Destaque sobe o produto na home. Lançamento e o selo extra aparecem no card."
      >
        <label className="flex items-center gap-2">
          <Switch checked={featured} onChange={setFeatured} />
          <span className="type-body">Selo destaque</span>
        </label>
        <label className="flex items-center gap-2">
          <Switch checked={launch} onChange={setLaunch} />
          <span className="type-body">Selo lançamento</span>
        </label>
        <label className="block max-w-sm space-y-1">
          <span className="type-fine-print text-[var(--ink-muted-48)]">Selo adicional</span>
          <input
            className={fieldClass}
            value={extraBadge}
            onChange={(e) => setExtraBadge(e.target.value)}
            placeholder="Exclusivo"
            maxLength={40}
          />
        </label>
      </Section>

      <Section title="Categoria">
        <PillSelect
          size="field"
          value={categoryId}
          onChange={setCategoryId}
          aria-label="Categoria"
          options={[
            { value: "", label: "Sem categoria" },
            ...(data?.categories ?? []).map((c) => ({ value: c.id, label: c.name })),
          ]}
        />
      </Section>

      <Section title="Endereço na loja" hint="É o link do produto. Sem espaços.">
        <input className={fieldClass} value={slug} onChange={(e) => setSlug(e.target.value)} />
        {publicHref ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            Vitrine:{" "}
            <Link href={publicHref} className="text-[var(--primary)]" target="_blank">
              {publicHref}
            </Link>
          </p>
        ) : null}
      </Section>
      </div>
      </div>

      <Section
        title="Variações"
        hint="Cada linha vira uma opção na página do produto. Sem variação, vale o preço e o estoque do produto."
      >
        <form
          className="grid gap-2 sm:grid-cols-5"
          onSubmit={(e) => {
            e.preventDefault();
            addVariant.mutate();
          }}
        >
          <input className={fieldClass} value={optKey} onChange={(e) => setOptKey(e.target.value)} placeholder="Opção" />
          <input className={fieldClass} value={optVal} onChange={(e) => setOptVal(e.target.value)} placeholder="Valor" required />
          <input className={fieldClass} value={sku} onChange={(e) => setSku(e.target.value)} placeholder="SKU" />
          <input className={fieldClass} value={stockQty} onChange={(e) => setStockQty(e.target.value)} placeholder="Qtd" />
          <input className={fieldClass} value={variantPrice} onChange={(e) => setVariantPrice(e.target.value)} placeholder="Preço" />
          <button type="submit" className={cn(buttonVariants({ variant: "outline" }), "h-11 sm:col-span-5")}>
            Adicionar variação
          </button>
        </form>
        <ul className="divide-y divide-[var(--hairline)]">
          {product.variants.length === 0 ? (
            <li className="py-2 type-caption text-[var(--ink-muted-48)]">Nenhuma variação.</li>
          ) : (
            product.variants.map((v) => (
              <li key={v.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                <div>
                  <p className="type-body-strong">
                    {Object.entries(v.options || {})
                      .map(([k, val]) => `${k}: ${val}`)
                      .join(" · ") || "Padrão"}
                  </p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    {v.sku ? `SKU ${v.sku} · ` : ""}
                    {v.priceCents != null ? brl(v.priceCents) : "Preço do produto"}
                    {" · "}
                    {v.stockQty} un.
                  </p>
                </div>
                <Switch
                  checked={v.active}
                  onChange={(checked) => patchVariant.mutate({ id: v.id, active: checked })}
                />
              </li>
            ))
          )}
        </ul>
      </Section>
    </div>
  );
}
