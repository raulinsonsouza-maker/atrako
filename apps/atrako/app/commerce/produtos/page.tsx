"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  Check,
  ChevronDown,
  ChevronUp,
  Download,
  ExternalLink,
  History,
  Loader2,
  Pencil,
  Plus,
  SlidersHorizontal,
  Trash2,
} from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { SearchInput } from "@/components/ui/search-input";
import { PillSelect } from "@/components/ui/pill-select";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

type Variant = { id: string; sku: string | null; stockQty: number };
type Product = {
  id: string;
  name: string;
  slug: string;
  priceCents: number;
  status: string;
  active: boolean;
  coverUrl: string | null;
  stockTracked: boolean;
  soldQty?: number;
  updatedAt: string;
  category: { id: string; name: string } | null;
  categoryId: string | null;
  variants: Variant[];
};

type SortKey = "code" | "name" | "category" | "price" | "stock" | "sold" | "status";

function brl(cents: number) {
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function codeOf(product: Product) {
  return product.variants.find((v) => v.sku)?.sku || product.id.slice(-8);
}

function stockOf(product: Product) {
  if (!product.stockTracked) return null;
  return product.variants.reduce((sum, variant) => sum + variant.stockQty, 0);
}

function downloadCsv(rows: Product[]) {
  const header = ["Código", "Nome", "Categoria", "Preço", "Estoque", "Vendas", "Status"];
  const lines = rows.map((product) => {
    const stock = stockOf(product);
    return [
      codeOf(product),
      product.name,
      product.category?.name || "",
      (product.priceCents / 100).toFixed(2).replace(".", ","),
      stock == null ? "" : String(stock),
      String(product.soldQty ?? 0),
      product.active ? "Ativo" : "Inativo",
    ]
      .map((cell) => `"${cell.replaceAll('"', '""')}"`)
      .join(";");
  });
  const blob = new Blob([[header.join(";"), ...lines].join("\n")], {
    type: "text/csv;charset=utf-8",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = "produtos.csv";
  a.click();
  URL.revokeObjectURL(url);
}

export default function CommerceProductsPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const moreRef = useRef<HTMLDivElement>(null);
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"list" | "history">("list");
  const [filtersOpen, setFiltersOpen] = useState(true);
  const [moreOpen, setMoreOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const [name, setName] = useState("");
  const [price, setPrice] = useState("");
  const [categoryId, setCategoryId] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [stockFilter, setStockFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [selected, setSelected] = useState<string[]>([]);
  const [sort, setSort] = useState<{ key: SortKey; dir: "asc" | "desc" }>({
    key: "name",
    dir: "asc",
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

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-catalog", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/catalog?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{
        products: Product[];
        categories: { id: string; name: string }[];
      }>;
    },
  });

  useEffect(() => {
    if (!moreOpen) return;
    function onPointer(event: MouseEvent) {
      if (!moreRef.current?.contains(event.target as Node)) setMoreOpen(false);
    }
    window.addEventListener("mousedown", onPointer);
    return () => window.removeEventListener("mousedown", onPointer);
  }, [moreOpen]);

  const patch = useMutation({
    mutationFn: async (body: Record<string, unknown>) => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "product", ...body }),
      });
      if (!r.ok) throw new Error("Falha ao atualizar");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] }),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "product", id }),
      });
      if (!r.ok) throw new Error("Falha ao excluir");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] }),
  });

  const create = useMutation({
    mutationFn: async () => {
      const priceCents = Math.round(Number(price.replace(",", ".")) * 100) || 0;
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          workspaceId,
          action: "product",
          name,
          priceCents,
          categoryId: categoryId || null,
          stockTracked: true,
        }),
      });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.error || "Falha");
      }
      return r.json() as Promise<{ product: { id: string } }>;
    },
    onSuccess: () => {
      setName("");
      setPrice("");
      setAdding(false);
      queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] });
    },
  });

  const archived = useMemo(
    () => (data?.products ?? []).filter((product) => product.status === "ARCHIVED"),
    [data?.products],
  );

  const products = useMemo(() => {
    const q = query.trim().toLowerCase();
    const list = (data?.products ?? []).filter((product) => product.status !== "ARCHIVED");
    const filtered = list.filter((product) => {
      if (statusFilter === "active" && !product.active) return false;
      if (statusFilter === "inactive" && product.active) return false;
      if (categoryFilter && product.categoryId !== categoryFilter && product.category?.id !== categoryFilter)
        return false;
      const stock = stockOf(product);
      if (stockFilter === "in" && stock === 0) return false;
      if (stockFilter === "out" && stock !== 0) return false;
      if (!q) return true;
      const sku = product.variants.some((variant) => variant.sku?.toLowerCase().includes(q));
      return product.name.toLowerCase().includes(q) || product.slug.toLowerCase().includes(q) || sku;
    });
    const dir = sort.dir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      const value = (product: Product) => {
        if (sort.key === "code") return codeOf(product);
        if (sort.key === "name") return product.name;
        if (sort.key === "category") return product.category?.name || "";
        if (sort.key === "price") return product.priceCents;
        if (sort.key === "stock") return stockOf(product) ?? -1;
        if (sort.key === "sold") return product.soldQty ?? 0;
        return product.active ? 1 : 0;
      };
      const left = value(a);
      const right = value(b);
      if (typeof left === "number" && typeof right === "number") return (left - right) * dir;
      return String(left).localeCompare(String(right), "pt-BR") * dir;
    });
  }, [data?.products, query, statusFilter, stockFilter, categoryFilter, sort]);

  function toggleSort(key: SortKey) {
    setSort((current) =>
      current.key === key
        ? { key, dir: current.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" },
    );
  }

  function toggleSelected(id: string) {
    setSelected((current) =>
      current.includes(id) ? current.filter((item) => item !== id) : [...current, id],
    );
  }

  const allSelected = products.length > 0 && products.every((product) => selected.includes(product.id));
  const storeSlug = storeData?.store?.slug;

  async function applyToSelected(active: boolean) {
    await Promise.all(selected.map((id) => patch.mutateAsync({ id, active })));
    setSelected([]);
  }

  async function archiveSelected() {
    await Promise.all(selected.map((id) => remove.mutateAsync(id)));
    setSelected([]);
  }

  const columns: { key: SortKey; label: string; className?: string }[] = [
    { key: "code", label: "Código" },
    { key: "name", label: "Produto" },
    { key: "category", label: "Categoria" },
    { key: "price", label: "Preço", className: "text-right" },
    { key: "stock", label: "Estoque", className: "text-right" },
    { key: "sold", label: "Vendas", className: "text-right" },
    { key: "status", label: "Status" },
  ];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <p className="type-fine-print text-[var(--ink-muted-48)]">Produtos</p>
          <h1 className="type-tagline text-[var(--ink)]">
            {view === "history" ? "Histórico de exclusões" : "Lista de produtos"}
          </h1>
        </div>
        <div className="flex items-center gap-2">
          <div className="relative" ref={moreRef}>
            <button
              type="button"
              className={cn(buttonVariants({ variant: "ghost" }), "h-9")}
              onClick={() => setMoreOpen((open) => !open)}
            >
              Mais opções
            </button>
            {moreOpen ? (
              <div className="pill-select-menu pill-select-menu-right min-w-52">
                <button
                  type="button"
                  className="pill-select-option type-caption"
                  onClick={() => {
                    downloadCsv(products);
                    setMoreOpen(false);
                  }}
                >
                  <Download className="h-3.5 w-3.5" strokeWidth={1.75} />
                  Exportar produtos
                </button>
                <button
                  type="button"
                  className="pill-select-option type-caption"
                  onClick={() => {
                    setView(view === "history" ? "list" : "history");
                    setMoreOpen(false);
                  }}
                >
                  <History className="h-3.5 w-3.5" strokeWidth={1.75} />
                  {view === "history" ? "Lista de produtos" : "Histórico de exclusões"}
                </button>
              </div>
            ) : null}
          </div>
          {view === "list" ? (
            <button
              type="button"
              className={cn(buttonVariants({ variant: "primary" }), "h-9 !px-3")}
              onClick={() => setAdding((open) => !open)}
            >
              <Plus className="h-4 w-4" />
              Adicionar produto
            </button>
          ) : null}
        </div>
      </div>

      {view === "history" ? (
        archived.length === 0 ? (
          <div className="rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-6 py-16 text-center">
            <p className="type-body-strong">Nenhum histórico encontrado</p>
            <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
              No momento não há registros de exclusão para exibir.
            </p>
          </div>
        ) : (
          <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
            {archived.map((product) => (
              <li key={product.id} className="flex items-center justify-between gap-3 px-4 py-3">
                <div>
                  <p className="type-body-strong">{product.name}</p>
                  <p className="type-fine-print text-[var(--ink-muted-48)]">
                    {codeOf(product)} ·{" "}
                    {new Date(product.updatedAt).toLocaleString("pt-BR")}
                  </p>
                </div>
                <button
                  type="button"
                  className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                  onClick={() => patch.mutate({ id: product.id, active: true, status: "PUBLISHED" })}
                >
                  Restaurar
                </button>
              </li>
            ))}
          </ul>
        )
      ) : (
        <>
          <div className="space-y-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-3">
            <div className="flex flex-wrap items-center gap-2">
              <SearchInput
                size="toolbar"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar por nome, código ou referência"
                aria-label="Buscar"
                className="min-w-[16rem] flex-1"
              />
              <button
                type="button"
                className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                onClick={() => setFiltersOpen((open) => !open)}
              >
                <SlidersHorizontal className="h-3.5 w-3.5" strokeWidth={1.75} />
                Filtro avançado
              </button>
            </div>
            {filtersOpen ? (
              <div className="flex flex-wrap gap-2">
                <PillSelect
                  value={statusFilter}
                  onChange={setStatusFilter}
                  aria-label="Status"
                  options={[
                    { value: "", label: "Status: Todos" },
                    { value: "active", label: "Ativo" },
                    { value: "inactive", label: "Inativo" },
                  ]}
                />
                <PillSelect
                  value={stockFilter}
                  onChange={setStockFilter}
                  aria-label="Estoque"
                  options={[
                    { value: "", label: "Estoque: Todos" },
                    { value: "in", label: "Com estoque" },
                    { value: "out", label: "Sem estoque" },
                  ]}
                />
                <PillSelect
                  value={categoryFilter}
                  onChange={setCategoryFilter}
                  aria-label="Categorias"
                  options={[
                    { value: "", label: "Categorias: Todas" },
                    ...(data?.categories ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </div>
            ) : null}
          </div>

          {adding ? (
            <form
              className="flex flex-wrap items-end gap-2 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white p-3"
              onSubmit={(e) => {
                e.preventDefault();
                if (!name.trim()) return;
                create.mutate();
              }}
            >
              <label className="flex min-w-[12rem] flex-1 flex-col gap-1">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Nome</span>
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Nome do produto"
                />
              </label>
              <label className="flex w-28 flex-col gap-1">
                <span className="type-fine-print text-[var(--ink-muted-48)]">Preço</span>
                <input
                  className="h-11 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 type-body"
                  value={price}
                  onChange={(e) => setPrice(e.target.value)}
                  placeholder="79,90"
                />
              </label>
              <div className="w-48">
                <span className="mb-1 block type-fine-print text-[var(--ink-muted-48)]">Categoria</span>
                <PillSelect
                  size="field"
                  value={categoryId}
                  onChange={setCategoryId}
                  aria-label="Categoria"
                  options={[
                    { value: "", label: "Sem categoria" },
                    ...(data?.categories ?? []).map((category) => ({
                      value: category.id,
                      label: category.name,
                    })),
                  ]}
                />
              </div>
              <button
                type="submit"
                disabled={create.isPending || !name.trim()}
                className={cn(buttonVariants({ variant: "primary" }), "h-11")}
              >
                {create.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                Criar
              </button>
            </form>
          ) : null}
          {create.isError ? (
            <p className="type-caption text-[var(--primary)]">{(create.error as Error).message}</p>
          ) : null}

          {selected.length > 0 ? (
            <div className="flex flex-wrap items-center gap-2">
              <span className="type-caption">{selected.length} selecionados</span>
              <button type="button" className={cn(buttonVariants({ variant: "outline" }), "h-9")} onClick={() => applyToSelected(true)}>
                Ativar
              </button>
              <button type="button" className={cn(buttonVariants({ variant: "outline" }), "h-9")} onClick={() => applyToSelected(false)}>
                Desativar
              </button>
              <button type="button" className={cn(buttonVariants({ variant: "outline" }), "h-9")} onClick={() => archiveSelected()}>
                Excluir
              </button>
            </div>
          ) : null}

          {isLoading ? (
            <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
          ) : products.length === 0 ? (
            <p className="type-caption text-[var(--ink-muted-48)]">Nenhum produto encontrado.</p>
          ) : (
            <div className="overflow-x-auto rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
              <table className="w-full min-w-[880px] border-collapse">
                <thead>
                  <tr className="border-b border-[var(--hairline)] text-left">
                    <th className="w-10 px-3 py-2">
                      <Mark
                        checked={allSelected}
                        label="Selecionar todos"
                        onClick={() =>
                          setSelected(allSelected ? [] : products.map((product) => product.id))
                        }
                      />
                    </th>
                    {columns.map((column) => (
                      <th key={column.key} className={cn("px-3 py-2", column.className)}>
                        <button
                          type="button"
                          className="inline-flex items-center gap-1 type-fine-print text-[var(--ink-muted-48)]"
                          onClick={() => toggleSort(column.key)}
                        >
                          {column.label}
                          {sort.key === column.key ? (
                            sort.dir === "asc" ? (
                              <ChevronUp className="h-3 w-3" />
                            ) : (
                              <ChevronDown className="h-3 w-3" />
                            )
                          ) : null}
                        </button>
                      </th>
                    ))}
                    <th className="px-3 py-2 text-right type-fine-print text-[var(--ink-muted-48)]">Ações</th>
                  </tr>
                </thead>
                <tbody>
                  {products.map((product) => {
                    const stock = stockOf(product);
                    const href = storeSlug ? `/loja/${storeSlug}/p/${product.slug}` : null;
                    return (
                      <tr key={product.id} className="border-b border-[var(--hairline)] last:border-0">
                        <td className="px-3 py-3">
                          <Mark
                            checked={selected.includes(product.id)}
                            label={`Selecionar ${product.name}`}
                            onClick={() => toggleSelected(product.id)}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <p className="type-caption">{codeOf(product)}</p>
                          <p className="type-fine-print text-[var(--ink-muted-48)]">{product.slug}</p>
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex items-center gap-3">
                            <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)]">
                              {product.coverUrl ? (
                                // eslint-disable-next-line @next/next/no-img-element
                                <img src={product.coverUrl} alt="" className="h-full w-full object-cover" />
                              ) : (
                                <span className="type-micro-legal text-[var(--ink-muted-48)]">—</span>
                              )}
                            </span>
                            <div className="min-w-0">
                              <Link href={`/commerce/produtos/${product.id}`} className="type-body-strong">
                                {product.name}
                              </Link>
                              {product.variants.length > 0 ? (
                                <p className="type-fine-print text-[var(--ink-muted-48)]">
                                  {product.variants.length} variaç{product.variants.length === 1 ? "ão" : "ões"}
                                </p>
                              ) : null}
                            </div>
                          </div>
                        </td>
                        <td className="px-3 py-3 type-caption">{product.category?.name || "—"}</td>
                        <td className="px-3 py-3 text-right type-caption tabular-nums">{brl(product.priceCents)}</td>
                        <td className="px-3 py-3 text-right type-caption tabular-nums">
                          {stock == null ? "—" : stock}
                        </td>
                        <td className="px-3 py-3 text-right type-caption tabular-nums">{product.soldQty ?? 0}</td>
                        <td className="px-3 py-3">
                          <PillSelect
                            value={product.active ? "active" : "inactive"}
                            onChange={(value) =>
                              patch.mutate({ id: product.id, active: value === "active" })
                            }
                            aria-label={`Status de ${product.name}`}
                            options={[
                              { value: "active", label: "Ativo" },
                              { value: "inactive", label: "Inativo" },
                            ]}
                          />
                        </td>
                        <td className="px-3 py-3">
                          <div className="flex justify-end gap-1">
                            {href ? (
                              <Link
                                href={href}
                                target="_blank"
                                className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 !px-0")}
                                aria-label="Ver produto na loja"
                              >
                                <ExternalLink className="h-4 w-4" strokeWidth={1.75} />
                              </Link>
                            ) : null}
                            <Link
                              href={`/commerce/produtos/${product.id}`}
                              className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 !px-0")}
                              aria-label="Editar produto"
                            >
                              <Pencil className="h-4 w-4" strokeWidth={1.75} />
                            </Link>
                            <button
                              type="button"
                              className={cn(buttonVariants({ variant: "ghost" }), "h-9 w-9 !px-0")}
                              aria-label="Excluir produto"
                              onClick={() => remove.mutate(product.id)}
                            >
                              <Trash2 className="h-4 w-4" strokeWidth={1.75} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function Mark({
  checked,
  onClick,
  label,
}: {
  checked: boolean;
  onClick: () => void;
  label: string;
}) {
  return (
    <button type="button" className="pill-select-check" data-checked={checked} aria-label={label} onClick={onClick}>
      {checked ? <Check className="h-3 w-3" strokeWidth={2.5} /> : null}
    </button>
  );
}
