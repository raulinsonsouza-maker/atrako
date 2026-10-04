"use client";

import { useEffect, useRef, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button, OptionChip, PillSelect } from "@/components/ui";
import { api, dateBR } from "@/components/relacionamento/format";
import type { EmailThemeConfig } from "@/lib/flows/theme";

type ThemeData = {
  draft: EmailThemeConfig;
  published: EmailThemeConfig | null;
  fonts: Array<{ value: string; label: string }>;
  publishedAt: string | null;
  testedAt: string | null;
  draftUpdatedAt: string | null;
  hasUnpublished: boolean;
  previewHtml: string;
};

const COLOR_FIELDS: Array<{ key: keyof EmailThemeConfig["colors"]; label: string }> = [
  { key: "accent", label: "Botões e destaques" },
  { key: "buttonText", label: "Texto do botão" },
  { key: "background", label: "Fundo" },
  { key: "card", label: "Cartão do e-mail" },
  { key: "text", label: "Texto" },
  { key: "muted", label: "Texto secundário" },
];

const SOCIALS = [
  { key: "instagram", label: "Instagram" },
  { key: "facebook", label: "Facebook" },
  { key: "tiktok", label: "TikTok" },
  { key: "youtube", label: "YouTube" },
  { key: "whatsapp", label: "WhatsApp" },
  { key: "site", label: "Site" },
] as const;

function ColorField({ label, value, onChange }: { label: string; value: string; onChange: (v: string) => void }) {
  const [text, setText] = useState(value);
  useEffect(() => setText(value), [value]);
  return (
    <label className="flex items-center gap-2">
      <input type="color" value={value} onChange={(e) => onChange(e.target.value)} className="h-9 w-9 shrink-0 cursor-pointer rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-transparent p-0.5" aria-label={label} />
      <span className="min-w-0 flex-1">
        <span className="rel-label type-fine-print" style={{ marginBottom: 0 }}>
          {label}
        </span>
        <input
          className="rel-input type-caption"
          value={text}
          onChange={(e) => {
            setText(e.target.value);
            if (/^#[0-9a-f]{6}$/i.test(e.target.value)) onChange(e.target.value);
          }}
        />
      </span>
    </label>
  );
}

export function ThemeTab({ workspaceId }: { workspaceId: string }) {
  const qc = useQueryClient();
  const key = ["rel-theme", workspaceId];
  const { data, isLoading } = useQuery({
    queryKey: key,
    queryFn: () => api<ThemeData>(`/api/atrako/relacionamento/theme?workspaceId=${workspaceId}`),
  });
  const [theme, setTheme] = useState<EmailThemeConfig | null>(null);
  const [dirty, setDirty] = useState(false);
  const [html, setHtml] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<string | null>(null);
  const [testTo, setTestTo] = useState("");
  const [uploading, setUploading] = useState<"logo" | "photo" | null>(null);
  const seeded = useRef(false);

  useEffect(() => {
    if (data && !seeded.current) {
      seeded.current = true;
      setTheme(data.draft);
      setHtml(data.previewHtml);
    }
  }, [data]);
  useEffect(() => setTestTo(localStorage.getItem("rel-test-email") ?? ""), []);

  const serialized = theme ? JSON.stringify(theme) : "";
  useEffect(() => {
    if (!serialized || !dirty) return;
    const t = setTimeout(() => {
      api<{ html: string }>("/api/atrako/relacionamento/theme", { body: { workspaceId, action: "preview", theme: JSON.parse(serialized) } })
        .then((r) => setHtml(r.html))
        .catch(() => null);
    }, 400);
    return () => clearTimeout(t);
  }, [serialized, dirty, workspaceId]);

  if (isLoading || !data || !theme) {
    return (
      <div className="flex justify-center py-16">
        <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
      </div>
    );
  }

  const patch = (p: Partial<EmailThemeConfig>) => {
    setTheme({ ...theme, ...p });
    setDirty(true);
  };
  const run = async (label: string, fn: () => Promise<string>) => {
    setBusy(label);
    setMsg(null);
    try {
      setMsg(await fn());
      await qc.invalidateQueries({ queryKey: key });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Erro");
    } finally {
      setBusy(null);
    }
  };
  const saveDraft = async () => {
    await api("/api/atrako/relacionamento/theme", { body: { workspaceId, action: "save", theme } });
    setDirty(false);
  };
  const upload = async (target: "logo" | "photo", file: File) => {
    setUploading(target);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", workspaceId);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Falha no upload");
      const abs = j.url.startsWith("http") ? j.url : `${window.location.origin}${j.url}`;
      if (target === "logo") patch({ logoUrl: abs });
      else patch({ signature: { ...theme.signature, photoUrl: abs } });
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(null);
    }
  };

  const testFresh = Boolean(data.testedAt && (!data.draftUpdatedAt || data.testedAt >= data.draftUpdatedAt) && !dirty);

  return (
    <div className="flex flex-col gap-4">
      <section className="rel-card flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="type-body-strong text-[var(--ink)]">Tema único de todos os e-mails</h2>
          <p className="type-fine-print text-[var(--ink-muted-48)]">
            {data.publishedAt ? `Publicado em ${dateBR(data.publishedAt, true)}` : "Ainda não publicado — os e-mails usam a marca de Config → Empresa"}
            {data.hasUnpublished || dirty ? " · há alterações não publicadas" : ""}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          {data.hasUnpublished ? (
            <Button
              variant="ghost"
              disabled={!!busy}
              onClick={() =>
                run("discard", async () => {
                  await api("/api/atrako/relacionamento/theme", { body: { workspaceId, action: "discard" } });
                  seeded.current = false;
                  setDirty(false);
                  return "Alterações descartadas.";
                })
              }
            >
              Descartar
            </Button>
          ) : null}
          <Button variant="outline" className="px-4 py-2" disabled={!!busy || !dirty} onClick={() => run("save", async () => (await saveDraft(), "Rascunho salvo."))}>
            {busy === "save" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Salvar rascunho
          </Button>
          <Button
            className="px-4 py-2"
            disabled={!!busy || !testFresh || !data.hasUnpublished}
            title={!testFresh ? "Envie um teste da versão atual antes de publicar" : undefined}
            onClick={() =>
              run("publish", async () => {
                await api("/api/atrako/relacionamento/theme", { body: { workspaceId, action: "publish" } });
                return "Tema publicado. Todos os e-mails passam a usar este visual.";
              })
            }
          >
            {busy === "publish" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            Publicar
          </Button>
        </div>
      </section>
      {msg ? <p className="rel-card type-caption text-[var(--ink)]">{msg}</p> : null}

      <div className="rel-editor">
        <div className="space-y-4">
          <section className="rel-card space-y-3">
            <h3 className="type-caption-strong text-[var(--ink)]">Cabeçalho</h3>
            <div className="flex flex-wrap items-center gap-2">
              {theme.logoUrl ? <img src={theme.logoUrl} alt="Logo" className="h-10 w-auto max-w-[160px] object-contain" /> : null}
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2 type-caption text-[var(--ink)] active:scale-95">
                {uploading === "logo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                {theme.logoUrl ? "Trocar logo" : "Enviar logo"}
                <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload("logo", e.target.files[0])} />
              </label>
              {theme.logoUrl ? (
                <Button variant="ghost" onClick={() => patch({ logoUrl: null })}>
                  Remover
                </Button>
              ) : null}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="rel-label type-fine-print">Largura do logo</span>
                <PillSelect
                  size="field"
                  value={String(theme.logoWidth)}
                  onChange={(v) => patch({ logoWidth: Number(v) })}
                  options={[100, 120, 140, 160, 200].map((n) => ({ value: String(n), label: `${n}px` }))}
                  aria-label="Largura do logo"
                />
              </div>
              <div>
                <span className="rel-label type-fine-print">Alinhamento</span>
                <PillSelect
                  size="field"
                  value={theme.headerAlign}
                  onChange={(v) => patch({ headerAlign: v === "left" ? "left" : "center" })}
                  options={[
                    { value: "center", label: "Centralizado" },
                    { value: "left", label: "À esquerda" },
                  ]}
                  aria-label="Alinhamento"
                />
              </div>
            </div>
            <ColorField label="Fundo do cabeçalho" value={theme.headerBg} onChange={(v) => patch({ headerBg: v })} />
          </section>

          <section className="rel-card space-y-3">
            <h3 className="type-caption-strong text-[var(--ink)]">Cores e fonte</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              {COLOR_FIELDS.map((c) => (
                <ColorField key={c.key} label={c.label} value={theme.colors[c.key]} onChange={(v) => patch({ colors: { ...theme.colors, [c.key]: v } })} />
              ))}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <span className="rel-label type-fine-print">Fonte (seguras para e-mail)</span>
                <PillSelect
                  size="field"
                  value={theme.font}
                  onChange={(v) => patch({ font: v as EmailThemeConfig["font"] })}
                  options={data.fonts}
                  aria-label="Fonte"
                />
              </div>
              <div>
                <span className="rel-label type-fine-print">Cantos do botão</span>
                <PillSelect
                  size="field"
                  value={String(theme.buttonRadius)}
                  onChange={(v) => patch({ buttonRadius: Number(v) })}
                  options={[
                    { value: "0", label: "Retos" },
                    { value: "4", label: "Leve" },
                    { value: "8", label: "Arredondados" },
                    { value: "24", label: "Pílula" },
                  ]}
                  aria-label="Cantos do botão"
                />
              </div>
            </div>
            <div className="flex flex-wrap gap-1.5">
              <OptionChip className="px-3 py-1.5" selected={theme.buttonUppercase} onClick={() => patch({ buttonUppercase: !theme.buttonUppercase })}>
                Botão em maiúsculas
              </OptionChip>
              <OptionChip
                className="px-3 py-1.5"
                selected={theme.productCard.showImage}
                onClick={() => patch({ productCard: { ...theme.productCard, showImage: !theme.productCard.showImage } })}
              >
                Foto dos produtos
              </OptionChip>
              <OptionChip
                className="px-3 py-1.5"
                selected={theme.productCard.showPrice}
                onClick={() => patch({ productCard: { ...theme.productCard, showPrice: !theme.productCard.showPrice } })}
              >
                Preço dos produtos
              </OptionChip>
              <OptionChip className="px-3 py-1.5" selected={theme.couponStyle === "dashed"} onClick={() => patch({ couponStyle: theme.couponStyle === "dashed" ? "solid" : "dashed" })}>
                Cupom tracejado
              </OptionChip>
            </div>
          </section>

          <section className="rel-card space-y-3">
            <h3 className="type-caption-strong text-[var(--ink)]">Tom de voz dos textos padrão</h3>
            <div className="flex flex-wrap gap-1.5">
              {(
                [
                  ["proximo", "Próximo (oi, você)"],
                  ["neutro", "Neutro"],
                  ["formal", "Formal"],
                ] as const
              ).map(([v, l]) => (
                <OptionChip key={v} className="px-3 py-1.5" selected={theme.tone === v} onClick={() => patch({ tone: v })}>
                  {l}
                </OptionChip>
              ))}
            </div>
            <p className="type-micro-legal text-[var(--ink-muted-48)]">Ao publicar, os textos que você não editou são reescritos no novo tom (e-mail e modelos WhatsApp novos).</p>
          </section>

          <section className="rel-card space-y-3">
            <h3 className="type-caption-strong text-[var(--ink)]">Assinatura</h3>
            <div className="grid gap-3 sm:grid-cols-2">
              <label>
                <span className="rel-label type-fine-print">Nome</span>
                <input className="rel-input type-caption" value={theme.signature.name ?? ""} onChange={(e) => patch({ signature: { ...theme.signature, name: e.target.value || null } })} />
              </label>
              <label>
                <span className="rel-label type-fine-print">Cargo / equipe</span>
                <input className="rel-input type-caption" value={theme.signature.role ?? ""} onChange={(e) => patch({ signature: { ...theme.signature, role: e.target.value || null } })} />
              </label>
            </div>
            <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2 type-caption text-[var(--ink)] active:scale-95">
              {uploading === "photo" ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
              {theme.signature.photoUrl ? "Trocar foto" : "Foto (opcional)"}
              <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={(e) => e.target.files?.[0] && void upload("photo", e.target.files[0])} />
            </label>
          </section>

          <section className="rel-card space-y-3">
            <h3 className="type-caption-strong text-[var(--ink)]">Rodapé</h3>
            <label className="block">
              <span className="rel-label type-fine-print">Endereço (exigido em e-mail de marketing)</span>
              <input className="rel-input type-caption" value={theme.footer.address ?? ""} onChange={(e) => patch({ footer: { ...theme.footer, address: e.target.value || null } })} />
            </label>
            <label className="block">
              <span className="rel-label type-fine-print">Texto legal (CNPJ, razão social)</span>
              <input className="rel-input type-caption" value={theme.footer.legal ?? ""} onChange={(e) => patch({ footer: { ...theme.footer, legal: e.target.value || null } })} />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              {SOCIALS.map((s) => (
                <label key={s.key}>
                  <span className="rel-label type-fine-print">{s.label}</span>
                  <input
                    className="rel-input type-caption"
                    placeholder="https://…"
                    value={theme.footer.socials[s.key] ?? ""}
                    onChange={(e) => patch({ footer: { ...theme.footer, socials: { ...theme.footer.socials, [s.key]: e.target.value || undefined } } })}
                  />
                </label>
              ))}
            </div>
          </section>
        </div>

        <div className="space-y-3">
          <section className="rel-card flex flex-wrap items-end gap-2">
            <label className="min-w-[200px] flex-1">
              <span className="rel-label type-fine-print">Enviar teste para</span>
              <input className="rel-input type-caption" inputMode="email" value={testTo} placeholder="voce@loja.com.br" onChange={(e) => setTestTo(e.target.value)} />
            </label>
            <Button
              variant="outline"
              className="px-4 py-2"
              disabled={!!busy || !testTo.trim()}
              onClick={() =>
                run("test", async () => {
                  if (dirty) await saveDraft();
                  localStorage.setItem("rel-test-email", testTo);
                  await api("/api/atrako/relacionamento/theme", { body: { workspaceId, action: "test", email: testTo } });
                  return `Teste enviado para ${testTo}. Confira no celular e no computador antes de publicar.`;
                })
              }
            >
              {busy === "test" ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              Enviar teste
            </Button>
            <span className="type-micro-legal w-full text-[var(--ink-muted-48)]">
              {data.testedAt ? `Último teste: ${dateBR(data.testedAt, true)}${testFresh ? "" : " (antes das últimas alterações)"}` : "Nenhum teste ainda"}
            </span>
          </section>
          <iframe title="Prévia do tema" className="rel-preview-frame" sandbox="" srcDoc={html} />
        </div>
      </div>
    </div>
  );
}
