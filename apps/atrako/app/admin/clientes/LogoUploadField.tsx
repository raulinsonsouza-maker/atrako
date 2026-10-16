"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { IconButton } from "@/components/ui/icon-button";

interface LogoUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
}

export function LogoUploadField({ value, onChange }: LogoUploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadError, setUploadError] = useState("");

  async function handleFile(file: File) {
    setUploading(true);
    setUploadError("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await fetch("/api/admin/upload-logo", {
        method: "POST",
        body: formData,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Erro no upload");
      onChange(data.url);
    } catch (e) {
      setUploadError(e instanceof Error ? e.message : "Erro no upload");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    if (value.startsWith("/logos/")) {
      await fetch("/api/admin/upload-logo", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
    }
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-1.5">
      {value ? (
        <div className="flex h-11 items-center gap-3 rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--canvas-parchment)] px-3">
          <Image
            src={value}
            alt="Logo"
            width={28}
            height={28}
            className="h-7 w-7 shrink-0 rounded-[var(--radius-xs)] object-contain"
            unoptimized
          />
          <p className="min-w-0 flex-1 truncate type-fine-print text-[var(--ink-muted-48)]">{value}</p>
          <Button
            type="button"
            variant="outline"
            className="!px-2.5 !py-1"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
          >
            {uploading ? "…" : "Trocar"}
          </Button>
          <IconButton
            size="toolbar"
            onClick={handleRemove}
            aria-label="Remover logo"
            className="!h-8 !w-8"
          >
            <X className="h-3.5 w-3.5" strokeWidth={1.75} />
          </IconButton>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex h-11 w-full items-center justify-center gap-2 rounded-[var(--radius-xs)] border border-dashed border-[var(--hairline)] bg-[var(--canvas-parchment)] type-caption text-[var(--ink-muted-48)] transition active:scale-95 disabled:opacity-50"
        >
          <Upload className="h-3.5 w-3.5" strokeWidth={1.75} />
          {uploading ? "Enviando…" : "Enviar logo"}
        </button>
      )}
      {uploadError ? <p className="type-fine-print text-[var(--danger)]">{uploadError}</p> : null}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/jpg,image/webp,image/svg+xml,image/gif"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
}
