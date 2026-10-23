"use client";

import { useRef, useState } from "react";
import { ImagePlus, Loader2 } from "lucide-react";
import { Button } from "./button";

export type LogoUploadProps = {
  workspaceId: string;
  label: string;
  hint?: React.ReactNode;
  value: string | null;
  onChange: (url: string | null) => void;
  /** Fundo da prévia — igual ao lugar onde o logo aparece. */
  surface?: "light" | "dark";
};

/** Envio de logo do workspace: prévia no fundo de uso + Enviar/Trocar/Remover. */
export function LogoUpload({ workspaceId, label, hint, value, onChange, surface = "light" }: LogoUploadProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function upload(file: File) {
    setUploading(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.set("workspaceId", workspaceId);
      fd.set("file", file);
      const r = await fetch("/api/atrako/criar/upload-image", { method: "POST", body: fd });
      const j = (await r.json().catch(() => ({}))) as { url?: string; error?: string };
      if (!r.ok || !j.url) throw new Error(j.error || "Falha no envio.");
      // URL completa: o logo também vai em e-mails, onde caminho relativo não abre.
      onChange(new URL(j.url, window.location.origin).toString());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Falha no envio.");
    } finally {
      setUploading(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  return (
    <div className="logo-upload">
      <p className="type-caption-strong text-[var(--ink)]">{label}</p>
      <div className="logo-upload-preview" data-surface={surface}>
        {value ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={value} alt={label} />
        ) : (
          <span className="type-fine-print">Sem logo</span>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <Button type="button" variant="outline" size="toolbar" disabled={uploading} onClick={() => inputRef.current?.click()}>
          {uploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <ImagePlus className="h-4 w-4" />}
          {uploading ? "Enviando…" : value ? "Trocar" : "Enviar logo"}
        </Button>
        {value && !uploading ? (
          <Button type="button" variant="ghost" size="toolbar" onClick={() => onChange(null)}>
            Remover
          </Button>
        ) : null}
      </div>
      {error ? <p className="type-fine-print text-[var(--danger)]">{error}</p> : null}
      {hint ? <p className="type-fine-print text-[var(--ink-muted-48)]">{hint}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) void upload(file);
        }}
      />
    </div>
  );
}
