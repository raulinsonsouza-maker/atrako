"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2, X } from "lucide-react";
import { useLpPuckCtx } from "@/lib/criar/puck/context";

type Props = {
  value: string;
  onChange: (value: string) => void;
  readOnly?: boolean;
};

export function LpImageFieldInput({ value, onChange, readOnly }: Props) {
  const ctx = useLpPuckCtx();
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");
  const src = (value || "").trim();

  async function upload(file: File) {
    const workspaceId = ctx.product.clienteId?.trim();
    if (!workspaceId) {
      setError("Workspace indisponível.");
      return;
    }
    setUploading(true);
    setError("");
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("workspaceId", workspaceId);
      const res = await fetch("/api/atrako/criar/upload-image", {
        method: "POST",
        body: form,
      });
      const data = (await res.json().catch(() => ({}))) as {
        url?: string;
        error?: string;
      };
      if (!res.ok || !data.url) {
        throw new Error(data.error || "Falha no upload");
      }
      onChange(data.url);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no upload");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  if (readOnly) {
    return src ? (
      // eslint-disable-next-line @next/next/no-img-element
      <img src={src} alt="" className="lp-image-field-thumb" />
    ) : (
      <p className="type-fine-print text-[var(--ink-muted-48)]">—</p>
    );
  }

  return (
    <div className="lp-image-field">
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="sr-only"
        onChange={(e) => {
          const f = e.target.files?.[0];
          if (f) void upload(f);
        }}
      />

      {src ? (
        <div className="lp-image-field-row">
          <button
            type="button"
            className="lp-image-field-thumb-btn"
            disabled={uploading}
            onClick={() => inputRef.current?.click()}
            aria-label="Trocar imagem"
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={src} alt="" className="lp-image-field-thumb" />
            {uploading ? (
              <span className="lp-image-field-busy">
                <Loader2 className="lp-image-field-spin" strokeWidth={1.75} />
              </span>
            ) : null}
          </button>
          <button
            type="button"
            className="lp-image-field-remove"
            aria-label="Remover"
            onClick={() => onChange("")}
          >
            <X strokeWidth={1.75} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          className="lp-image-field-add"
          disabled={uploading}
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
          }}
          onDrop={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const f = e.dataTransfer.files?.[0];
            if (f) void upload(f);
          }}
        >
          {uploading ? (
            <Loader2 className="lp-image-field-spin" strokeWidth={1.75} />
          ) : (
            <ImagePlus strokeWidth={1.75} />
          )}
          <span>{uploading ? "Enviando…" : "Adicionar imagem"}</span>
        </button>
      )}

      <input
        type="url"
        className="lp-image-field-url"
        spellCheck={false}
        placeholder="ou cole uma URL…"
        value={value || ""}
        onChange={(e) => onChange(e.target.value)}
        aria-label="URL da imagem"
      />

      {error ? (
        <p className="lp-image-field-error type-micro-legal">{error}</p>
      ) : null}
    </div>
  );
}

export function imageField(label = "Imagem") {
  return {
    type: "custom" as const,
    label,
    render: ({
      value,
      onChange,
      readOnly,
    }: {
      value: string;
      onChange: (v: string) => void;
      readOnly?: boolean;
    }) => (
      <LpImageFieldInput
        value={typeof value === "string" ? value : ""}
        onChange={onChange}
        readOnly={readOnly}
      />
    ),
  };
}
