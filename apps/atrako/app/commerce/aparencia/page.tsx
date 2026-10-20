"use client";

import { useEffect, useRef, useState } from "react";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Upload } from "lucide-react";
import { useWorkspaceConfig, workspaceConfigKey } from "@/app/config/_components";
import { BrandColorPicker } from "@/components/ui/brand-color-picker";
import { buttonVariants } from "@/components/ui/button";
import { TextField } from "@/components/ui/text-field";
import { useActiveWorkspace } from "@/hooks/useActiveWorkspace";
import { asStoreTheme, type StoreTheme } from "@/lib/commerce/theme";
import { DEFAULT_PRIMARY, normalizePrimaryHex } from "@/lib/brand/primaryColor";
import { cn } from "@/lib/utils";

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

export default function CommerceAppearancePage() {
  const { workspaceId, isReady } = useActiveWorkspace();
  const configQuery = useWorkspaceConfig();
  const queryClient = useQueryClient();
  const fileRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [theme, setTheme] = useState<StoreTheme>(() => asStoreTheme(null));
  const [color, setColor] = useState(DEFAULT_PRIMARY);
  const [hydrated, setHydrated] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const { data, isLoading, isError, isFetched } = useQuery({
    queryKey: ["commerce-store", workspaceId],
    enabled: Boolean(workspaceId),
    queryFn: async () => {
      const r = await fetch(`/api/atrako/commerce/store?workspaceId=${workspaceId}`);
      if (!r.ok) throw new Error("fail");
      return r.json() as Promise<{ store: { name: string; theme: StoreTheme } | null }>;
    },
  });

  useEffect(() => {
    if (!data?.store || hydrated) return;
    setName(data.store.name);
    setTheme(asStoreTheme(data.store.theme));
    setHydrated(true);
  }, [data, hydrated]);

  useEffect(() => {
    const hex = normalizePrimaryHex(configQuery.data?.settings?.primaryColor);
    if (hex) setColor(hex);
  }, [configQuery.data?.settings?.primaryColor]);

  const save = useMutation({
    mutationFn: async () => {
      const hex = normalizePrimaryHex(color);
      if (!hex) throw new Error("Cor inválida.");
      if (!name.trim()) throw new Error("Informe o nome da loja.");
      const storeRes = await fetch("/api/atrako/commerce/store", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, name: name.trim(), theme }),
      });
      if (!storeRes.ok) throw new Error("Falha ao salvar a loja");
      const colorRes = await fetch("/api/atrako/config", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ workspaceId, primaryColor: hex }),
      });
      if (!colorRes.ok) throw new Error("Falha ao salvar a cor");
    },
    onSuccess: async () => {
      setError(null);
      await queryClient.invalidateQueries({ queryKey: ["commerce-store", workspaceId] });
      await queryClient.invalidateQueries({ queryKey: workspaceConfigKey(workspaceId) });
    },
    onError: (err: Error) => setError(err.message),
  });

  async function uploadLogo(file: File) {
    if (!workspaceId) return;
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("file", file);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      if (!r.ok) throw new Error("Upload falhou");
      const json = (await r.json()) as { url?: string };
      if (!json.url) return;
      setTheme((current) => ({ ...current, logoUrl: json.url as string }));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Upload falhou");
    } finally {
      setUploading(false);
    }
  }

  if (!isReady || (workspaceId && (isLoading || configQuery.isLoading))) {
    return <p className="type-caption text-[var(--ink-muted-48)]">Carregando…</p>;
  }
  if (!workspaceId) return null;
  if (isError || (isFetched && !data?.store)) {
    return <p className="type-body">Não foi possível carregar a aparência da loja.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="type-tagline text-[var(--ink)]">Aparência</h1>
          <p className="mt-1 type-caption text-[var(--ink-muted-48)]">
            Nome, logo, cor e os textos do topo e do rodapé da vitrine.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {error ? <p className="type-caption text-[var(--primary)]">{error}</p> : null}
          {save.isSuccess && !error ? <p className="type-caption text-[var(--success)]">Salvo.</p> : null}
          <button
            type="button"
            className={cn(buttonVariants({ variant: "primary" }))}
            disabled={save.isPending}
            onClick={() => save.mutate()}
          >
            {save.isPending ? "Salvando…" : "Salvar"}
          </button>
        </div>
      </div>

      <Section title="Identidade" hint="A logo aparece no topo. Sem logo, a vitrine mostra o nome.">
        <div className="flex flex-wrap items-center gap-4">
          <div className="flex h-16 min-w-16 items-center justify-center rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas)] px-3">
            {theme.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={theme.logoUrl} alt="" className="h-10 w-auto max-w-40 object-contain" />
            ) : (
              <span className="type-fine-print text-[var(--ink-muted-48)]">Sem logo</span>
            )}
          </div>
          <input
            ref={fileRef}
            type="file"
            accept="image/png,image/jpeg,image/webp,image/gif"
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) void uploadLogo(file);
              e.target.value = "";
            }}
          />
          <button
            type="button"
            className={cn(buttonVariants({ variant: "outline" }), "!gap-1.5")}
            disabled={uploading}
            onClick={() => fileRef.current?.click()}
          >
            <Upload className="h-4 w-4" />
            {uploading ? "Enviando…" : "Enviar logo"}
          </button>
          {theme.logoUrl ? (
            <button
              type="button"
              className={cn(buttonVariants({ variant: "ghost" }))}
              onClick={() => setTheme((current) => ({ ...current, logoUrl: null }))}
            >
              Remover
            </button>
          ) : null}
        </div>
        <TextField label="Nome da loja" value={name} onChange={(e) => setName(e.target.value)} required />
        <div>
          <p className="type-caption-strong text-[var(--ink)]">Cor da marca</p>
          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">
            Botões, preço, selos e o item ativo do menu.
          </p>
          <BrandColorPicker className="mt-3" value={color} onChange={setColor} brandName={name || "Sua loja"} />
        </div>
      </Section>

      <Section title="Faixa do topo" hint="Vazio: a loja usa o aviso de frete grátis.">
        <TextField
          label="Texto"
          value={theme.announce}
          onChange={(e) => setTheme((current) => ({ ...current, announce: e.target.value }))}
          placeholder="Frete grátis acima de R$ 350,00 · Entrega para todo o Brasil"
        />
      </Section>

      <Section title="Rodapé e contato" hint="Instagram e WhatsApp também viram os botões flutuantes.">
        <label className="block">
          <span className="type-caption-strong text-[var(--ink)]">Sobre a loja</span>
          <textarea
            value={theme.about}
            onChange={(e) => setTheme((current) => ({ ...current, about: e.target.value }))}
            rows={3}
            className="mt-2 w-full resize-y rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-5 py-3 type-body text-[var(--ink)] outline-none focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]"
            placeholder="Uma frase sobre a loja, o que vende e para onde envia."
          />
        </label>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label="Instagram"
            value={theme.instagram}
            onChange={(e) => setTheme((current) => ({ ...current, instagram: e.target.value }))}
            placeholder="@sualoja"
          />
          <TextField
            label="WhatsApp"
            value={theme.whatsapp}
            onChange={(e) => setTheme((current) => ({ ...current, whatsapp: e.target.value }))}
            placeholder="5511999999999"
          />
          <TextField
            label="E-mail"
            value={theme.email}
            onChange={(e) => setTheme((current) => ({ ...current, email: e.target.value }))}
            placeholder="contato@sualoja.com.br"
          />
          <TextField
            label="Horário"
            value={theme.hours}
            onChange={(e) => setTheme((current) => ({ ...current, hours: e.target.value }))}
            placeholder="Seg–sex 9h–18h"
          />
        </div>
      </Section>
    </div>
  );
}
