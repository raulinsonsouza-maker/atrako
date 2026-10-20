"use client";

import { useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Plus } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { cn } from "@/lib/utils";

type Category = {
  id: string;
  name: string;
  slug: string;
  active: boolean;
  sortOrder: number;
  imageUrl: string | null;
};

function initials(name: string) {
  return name
    .split(/\s+/)
    .slice(0, 2)
    .map((word) => word[0]?.toUpperCase() ?? "")
    .join("");
}

export default function CommerceCategoriesPage() {
  const { workspaceId } = useActiveWorkspace();
  const queryClient = useQueryClient();
  const [name, setName] = useState("");
  const [uploadingId, setUploadingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const targetId = useRef<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["commerce-catalog", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/catalog?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ categories: Category[] }>;
    },
  });

  const create = useMutation({
    mutationFn: async () => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "category", name }),
      });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () => {
      setName("");
      queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] });
    },
  });

  const patch = useMutation({
    mutationFn: async (payload: { id: string; active?: boolean; imageUrl?: string | null }) => {
      const r = await fetch("/api/atrako/commerce/catalog", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, action: "category", ...payload }),
      });
      if (!r.ok) throw new Error("Falha");
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["commerce-catalog", workspaceId] }),
  });

  async function uploadImage(file: File) {
    const id = targetId.current;
    if (!workspaceId || !id) return;
    setUploadingId(id);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("file", file);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload falhou");
      const json = (await r.json()) as { url?: string };
      if (!json.url) throw new Error("Upload falhou");
      await patch.mutateAsync({ id, imageUrl: json.url });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload falhou");
    } finally {
      setUploadingId(null);
    }
  }

  return (
    <div className="space-y-5">
      <div>
        <h1 className="type-tagline text-[var(--ink)]">Categorias</h1>
        <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
          Cada categoria vira um círculo na vitrine. A imagem preenche o círculo; sem imagem, a loja mostra as iniciais.
        </p>
      </div>

      <form
        className="flex flex-wrap gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) create.mutate();
        }}
      >
        <input
          className="h-11 min-w-[12rem] flex-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white px-3 type-body"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nova categoria"
        />
        <button type="submit" className={cn(buttonVariants({ variant: "primary" }), "h-11 !gap-1.5")}>
          <Plus className="h-4 w-4" />
          Adicionar
        </button>
      </form>

      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void uploadImage(file);
          e.target.value = "";
        }}
      />

      {error ? <p className="type-caption text-[var(--primary)]">{error}</p> : null}

      {isLoading ? (
        <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>
      ) : (
        <ul className="divide-y divide-[var(--hairline)] rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-white">
          {(data?.categories ?? []).map((c) => (
            <li key={c.id} className="flex items-center gap-4 px-4 py-3">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center overflow-hidden rounded-full bg-[var(--primary)] text-[var(--on-primary)]">
                {c.imageUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={c.imageUrl} alt="" className="h-full w-full object-cover" />
                ) : (
                  <span className="type-body-strong">{initials(c.name)}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="type-body-strong">{c.name}</p>
                <p className="type-fine-print text-[var(--ink-muted-48)]">/{c.slug}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    type="button"
                    className={cn(buttonVariants({ variant: "outline" }), "h-9")}
                    disabled={uploadingId === c.id}
                    onClick={() => {
                      targetId.current = c.id;
                      fileRef.current?.click();
                    }}
                  >
                    {uploadingId === c.id ? "Enviando…" : c.imageUrl ? "Trocar imagem" : "Enviar imagem"}
                  </button>
                  {c.imageUrl ? (
                    <button
                      type="button"
                      className={cn(buttonVariants({ variant: "ghost" }), "h-9")}
                      onClick={() => patch.mutate({ id: c.id, imageUrl: null })}
                    >
                      Remover
                    </button>
                  ) : null}
                </div>
              </div>
              <Switch
                checked={c.active}
                onChange={(checked) => patch.mutate({ id: c.id, active: checked })}
              />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
