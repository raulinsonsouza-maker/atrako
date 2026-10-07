"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown, ArrowUp, ImagePlus, Loader2, Trash2 } from "lucide-react";
import { OptionChip, PillSelect } from "@/components/ui";
import type { EmailBlock, EmailBlockType, EmailContent } from "@/lib/flows/types";
import { EmailPhone } from "@/components/relacionamento/phone/MessagePhone";

export type EmailPreview = { html: string; bytes?: number; clipped?: boolean; problems?: string[] };

const BLOCK_LABEL: Record<EmailBlockType, string> = {
  heading: "Título",
  text: "Texto",
  items: "Itens do pedido/carrinho",
  coupon: "Cupom",
  recommendations: "Recomendados",
  button: "Botão",
  image: "Imagem",
  divider: "Divisor",
  signature: "Assinatura",
};

const VARIABLES = [
  { key: "primeiro_nome", label: "Primeiro nome" },
  { key: "nome", label: "Nome" },
  { key: "loja", label: "Loja" },
  { key: "cupom", label: "Cupom" },
  { key: "validade", label: "Validade" },
  { key: "produto", label: "Produto" },
  { key: "itens", label: "Itens" },
  { key: "total", label: "Total" },
];

function emptyBlock(type: EmailBlockType): EmailBlock {
  switch (type) {
    case "heading":
      return { type, text: "" };
    case "text":
      return { type, text: "" };
    case "button":
      return { type, label: "Ver na loja" };
    case "image":
      return { type, src: "" };
    case "items":
      return { type, title: "Seus itens" };
    case "coupon":
      return { type };
    case "recommendations":
      return { type, title: "Você também pode gostar", limit: 4 };
    default:
      return { type } as EmailBlock;
  }
}

type FieldRef = { blockIndex: number | "subject" | "preheader"; field: string };

export function EmailBlockEditor({
  workspaceId,
  value,
  onChange,
  preview,
  hasCoupon,
  readOnly,
}: {
  workspaceId: string;
  value: EmailContent;
  onChange: (next: EmailContent) => void;
  preview: (content: EmailContent) => Promise<EmailPreview>;
  hasCoupon?: boolean;
  readOnly?: boolean;
}) {
  const [pv, setPv] = useState<EmailPreview | null>(null);
  const [pvLoading, setPvLoading] = useState(false);
  const [pvError, setPvError] = useState<string | null>(null);
  const [uploading, setUploading] = useState<number | null>(null);
  const [device, setDevice] = useState<"desktop" | "mobile">("mobile");
  const focused = useRef<FieldRef | null>(null);
  const previewRef = useRef(preview);
  previewRef.current = preview;

  const serialized = JSON.stringify(value);
  useEffect(() => {
    let cancelled = false;
    setPvLoading(true);
    const t = setTimeout(() => {
      previewRef
        .current(JSON.parse(serialized) as EmailContent)
        .then((r) => {
          if (!cancelled) {
            setPv(r);
            setPvError(null);
          }
        })
        .catch((e: unknown) => !cancelled && setPvError(e instanceof Error ? e.message : "Erro na prévia"))
        .finally(() => !cancelled && setPvLoading(false));
    }, 500);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [serialized]);

  const setBlock = (i: number, patch: Partial<EmailBlock>) => {
    const blocks = value.blocks.slice();
    blocks[i] = { ...blocks[i], ...patch } as EmailBlock;
    onChange({ ...value, blocks });
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= value.blocks.length) return;
    const blocks = value.blocks.slice();
    [blocks[i], blocks[j]] = [blocks[j], blocks[i]];
    onChange({ ...value, blocks });
  };
  const remove = (i: number) => onChange({ ...value, blocks: value.blocks.filter((_, k) => k !== i) });
  const add = (type: EmailBlockType) => onChange({ ...value, blocks: [...value.blocks, emptyBlock(type)] });

  const insertVariable = (key: string) => {
    const f = focused.current;
    const token = `{{${key}}}`;
    if (!f) return;
    if (f.blockIndex === "subject") return onChange({ ...value, subject: `${value.subject}${value.subject.endsWith(" ") || !value.subject ? "" : " "}${token}` });
    if (f.blockIndex === "preheader") return onChange({ ...value, preheader: `${value.preheader ?? ""} ${token}`.trim() });
    const b = value.blocks[f.blockIndex] as Record<string, unknown> | undefined;
    if (!b) return;
    const cur = typeof b[f.field] === "string" ? (b[f.field] as string) : "";
    setBlock(f.blockIndex, { [f.field]: `${cur}${cur && !cur.endsWith(" ") ? " " : ""}${token}` } as Partial<EmailBlock>);
  };

  const upload = async (i: number, file: File) => {
    setUploading(i);
    try {
      const fd = new FormData();
      fd.append("file", file);
      fd.append("workspaceId", workspaceId);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Falha no upload");
      const abs = j.url.startsWith("http") ? j.url : `${window.location.origin}${j.url}`;
      if (!abs.startsWith("https://")) {
        setPvError("A imagem precisa de endereço https para aparecer no e-mail (em produção funciona).");
      }
      setBlock(i, { src: abs } as Partial<EmailBlock>);
    } catch (e) {
      setPvError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(null);
    }
  };

  const onFocus = (blockIndex: FieldRef["blockIndex"], field: string) => () => {
    focused.current = { blockIndex, field };
  };

  return (
    <div className="rel-editor">
      <div className="space-y-4">
        <div className="space-y-3">
          <label className="block">
            <span className="rel-label type-fine-print">Assunto</span>
            <input
              className="rel-input type-caption"
              value={value.subject}
              disabled={readOnly}
              maxLength={200}
              onFocus={onFocus("subject", "subject")}
              onChange={(e) => onChange({ ...value, subject: e.target.value })}
            />
            <span className="type-micro-legal text-[var(--ink-muted-48)]">{value.subject.length}/60 recomendado</span>
          </label>
          <label className="block">
            <span className="rel-label type-fine-print">Pré-cabeçalho (aparece ao lado do assunto)</span>
            <input
              className="rel-input type-caption"
              value={value.preheader ?? ""}
              disabled={readOnly}
              maxLength={200}
              onFocus={onFocus("preheader", "preheader")}
              onChange={(e) => onChange({ ...value, preheader: e.target.value })}
            />
          </label>
        </div>

        {!readOnly ? (
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="type-fine-print text-[var(--ink-muted-48)]">Inserir no campo selecionado:</span>
            {VARIABLES.map((v) => (
              <button
                key={v.key}
                type="button"
                className="rel-badge type-micro-legal"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => insertVariable(v.key)}
              >
                {v.label}
              </button>
            ))}
          </div>
        ) : null}

        <ol className="space-y-2">
          {value.blocks.map((b, i) => (
            <li key={i} className="rounded-[var(--radius-lg)] border border-[var(--hairline)] bg-[var(--canvas)] p-3">
              <div className="mb-2 flex items-center justify-between gap-2">
                <span className="type-caption-strong text-[var(--ink)]">{BLOCK_LABEL[b.type]}</span>
                {!readOnly ? (
                  <div className="flex items-center gap-1">
                    <button type="button" aria-label="Subir" className="p-1 text-[var(--ink-muted-48)] disabled:opacity-30" disabled={i === 0} onClick={() => move(i, -1)}>
                      <ArrowUp className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      aria-label="Descer"
                      className="p-1 text-[var(--ink-muted-48)] disabled:opacity-30"
                      disabled={i === value.blocks.length - 1}
                      onClick={() => move(i, 1)}
                    >
                      <ArrowDown className="h-4 w-4" />
                    </button>
                    <button type="button" aria-label="Remover" className="p-1 text-[var(--ink-muted-48)]" onClick={() => remove(i)}>
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ) : null}
              </div>
              {b.type === "heading" ? (
                <input className="rel-input type-caption" value={b.text} disabled={readOnly} onFocus={onFocus(i, "text")} onChange={(e) => setBlock(i, { text: e.target.value })} />
              ) : b.type === "text" ? (
                <>
                  <textarea
                    className="rel-textarea type-caption"
                    rows={4}
                    value={b.text}
                    disabled={readOnly}
                    onFocus={onFocus(i, "text")}
                    onChange={(e) => setBlock(i, { text: e.target.value })}
                  />
                  <span className="type-micro-legal text-[var(--ink-muted-48)]">Use **texto** para negrito. Linha em branco separa parágrafos.</span>
                </>
              ) : b.type === "items" || b.type === "recommendations" ? (
                <div className="grid gap-2 sm:grid-cols-[1fr_auto]">
                  <input
                    className="rel-input type-caption"
                    placeholder="Título da seção"
                    value={b.title ?? ""}
                    disabled={readOnly}
                    onFocus={onFocus(i, "title")}
                    onChange={(e) => setBlock(i, { title: e.target.value })}
                  />
                  {b.type === "recommendations" ? (
                    <PillSelect
                      value={String(b.limit ?? 4)}
                      onChange={(v) => setBlock(i, { limit: Number(v) })}
                      options={[2, 3, 4, 6].map((n) => ({ value: String(n), label: `${n} produtos` }))}
                      aria-label="Quantidade"
                    />
                  ) : null}
                  <span className="type-micro-legal text-[var(--ink-muted-48)] sm:col-span-2">
                    {b.type === "items" ? "Mostra os produtos do carrinho ou pedido com foto e preço." : "Produtos mais vendidos que o cliente ainda não comprou."}
                  </span>
                </div>
              ) : b.type === "coupon" ? (
                <div className="space-y-2">
                  <input
                    className="rel-input type-caption"
                    placeholder="Texto acima do cupom (ex.: Use o cupom abaixo e ganhe 10%)"
                    value={b.text ?? ""}
                    disabled={readOnly}
                    onFocus={onFocus(i, "text")}
                    onChange={(e) => setBlock(i, { text: e.target.value })}
                  />
                  <input
                    className="rel-input type-caption"
                    placeholder="Validade (ex.: até domingo)"
                    value={b.expires ?? ""}
                    disabled={readOnly}
                    onChange={(e) => setBlock(i, { expires: e.target.value })}
                  />
                  {!hasCoupon ? (
                    <span className="type-micro-legal text-[var(--ink-muted-48)]">Sem cupom definido: o bloco não aparece no e-mail.</span>
                  ) : null}
                </div>
              ) : b.type === "button" ? (
                <div className="grid gap-2 sm:grid-cols-2">
                  <input
                    className="rel-input type-caption"
                    placeholder="Texto do botão"
                    value={b.label}
                    maxLength={60}
                    disabled={readOnly}
                    onFocus={onFocus(i, "label")}
                    onChange={(e) => setBlock(i, { label: e.target.value })}
                  />
                  <input
                    className="rel-input type-caption"
                    placeholder="Link (vazio = checkout/loja)"
                    value={b.url ?? ""}
                    disabled={readOnly}
                    onChange={(e) => setBlock(i, { url: e.target.value })}
                  />
                </div>
              ) : b.type === "image" ? (
                <div className="space-y-2">
                  <div className="flex items-center gap-2">
                    <input
                      className="rel-input type-caption"
                      placeholder="https://… (imagem)"
                      value={b.src}
                      disabled={readOnly}
                      onChange={(e) => setBlock(i, { src: e.target.value })}
                    />
                    {!readOnly ? (
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1 rounded-[var(--radius-xs)] border border-[var(--hairline)] px-3 py-2 type-caption text-[var(--ink)] active:scale-95">
                        {uploading === i ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
                        Enviar
                        <input
                          type="file"
                          accept="image/png,image/jpeg,image/webp,image/gif"
                          className="hidden"
                          onChange={(e) => {
                            const f = e.target.files?.[0];
                            if (f) void upload(i, f);
                            e.target.value = "";
                          }}
                        />
                      </label>
                    ) : null}
                  </div>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <input className="rel-input type-caption" placeholder="Texto alternativo" value={b.alt ?? ""} disabled={readOnly} onChange={(e) => setBlock(i, { alt: e.target.value })} />
                    <input className="rel-input type-caption" placeholder="Link ao clicar (opcional)" value={b.href ?? ""} disabled={readOnly} onChange={(e) => setBlock(i, { href: e.target.value })} />
                  </div>
                  {b.src && !b.src.startsWith("https://") ? (
                    <span className="type-micro-legal text-[var(--ink-muted-48)]">Só imagens com https aparecem no e-mail.</span>
                  ) : null}
                </div>
              ) : b.type === "signature" ? (
                <span className="type-fine-print text-[var(--ink-muted-48)]">Assinatura e rodapé vêm do visual do e-mail (Ajustes › Visual do e-mail).</span>
              ) : null}
            </li>
          ))}
        </ol>

        {!readOnly ? (
          <div className="flex flex-wrap gap-1.5">
            {(Object.keys(BLOCK_LABEL) as EmailBlockType[]).map((t) => (
              <OptionChip key={t} className="px-3 py-1.5" onClick={() => add(t)}>
                + {BLOCK_LABEL[t]}
              </OptionChip>
            ))}
          </div>
        ) : null}
      </div>

      <div className="space-y-2">
        <div className="flex items-center justify-between gap-2">
          <div className="flex gap-1.5">
            <OptionChip className="px-3 py-1.5" selected={device === "mobile"} onClick={() => setDevice("mobile")}>
              Celular
            </OptionChip>
            <OptionChip className="px-3 py-1.5" selected={device === "desktop"} onClick={() => setDevice("desktop")}>
              Computador
            </OptionChip>
          </div>
          {pvLoading ? <Loader2 className="h-4 w-4 animate-spin text-[var(--ink-muted-48)]" /> : null}
        </div>
        {pv?.problems?.length ? (
          <p className="type-fine-print text-[var(--ink)]">Pendências: {pv.problems.join(" · ")}</p>
        ) : null}
        {pv?.clipped ? (
          <p className="type-fine-print text-[var(--ink)]">E-mail grande ({Math.round((pv.bytes ?? 0) / 1024)} KB): o Gmail corta acima de ~100 KB.</p>
        ) : null}
        {pvError ? <p className="type-fine-print text-[var(--ink)]">{pvError}</p> : null}
        <div className="flex justify-center lg:sticky lg:top-4">
          {device === "mobile" ? (
            <EmailPhone subject={value.subject} html={pv?.html ?? null} error={pvError} />
          ) : (
            <iframe title="Prévia do e-mail" className="rel-preview-frame" sandbox="" srcDoc={pv?.html ?? ""} />
          )}
        </div>
        <p className="type-micro-legal text-[var(--ink-muted-48)]">Prévia com dados de exemplo (itens reais da loja quando houver).</p>
      </div>
    </div>
  );
}
