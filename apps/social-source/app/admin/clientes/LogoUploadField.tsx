"use client";

import { useRef, useState } from "react";
import Image from "next/image";
import { Upload, X, ImageIcon } from "lucide-react";

interface LogoUploadFieldProps {
  value: string;
  onChange: (url: string) => void;
  adminToken: string;
}

export function LogoUploadField({ value, onChange, adminToken }: LogoUploadFieldProps) {
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
        headers: adminToken ? { "x-admin-token": adminToken } : {},
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
        headers: {
          "Content-Type": "application/json",
          ...(adminToken ? { "x-admin-token": adminToken } : {}),
        },
        body: JSON.stringify({ url: value }),
      });
    }
    onChange("");
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="space-y-2">
      {value ? (
        <div className="flex items-center gap-3 rounded-xl border border-[var(--border)] bg-[var(--background)] px-3 py-2.5">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[var(--muted)]">
            <Image
              src={value}
              alt="Logo"
              width={40}
              height={40}
              className="h-10 w-10 rounded-lg object-contain"
              unoptimized
            />
          </div>
          <p className="min-w-0 flex-1 truncate text-xs text-[var(--muted-foreground)]">{value}</p>
          <div className="flex shrink-0 items-center gap-1">
            <button
              type="button"
              onClick={() => inputRef.current?.click()}
              disabled={uploading}
              className="rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-[11px] font-semibold text-[var(--muted-foreground)] transition hover:bg-[var(--muted)] hover:text-[var(--foreground)] disabled:opacity-50"
            >
              {uploading ? "Enviando..." : "Trocar"}
            </button>
            <button
              type="button"
              onClick={handleRemove}
              className="flex h-7 w-7 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--muted-foreground)] transition hover:border-red-500/40 hover:bg-red-500/10 hover:text-red-500"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="flex w-full items-center justify-center gap-2.5 rounded-xl border border-dashed border-[var(--border)] bg-[var(--background)] py-4 text-sm text-[var(--muted-foreground)] transition hover:border-[var(--primary)]/40 hover:bg-[var(--primary)]/3 hover:text-[var(--primary)] disabled:opacity-50"
        >
          {uploading ? (
            <>
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-[var(--primary)] border-t-transparent" />
              Enviando...
            </>
          ) : (
            <>
              <ImageIcon className="h-4 w-4" />
              <Upload className="h-4 w-4" />
              Fazer upload do logo
            </>
          )}
        </button>
      )}
      {uploadError && (
        <p className="text-[11px] text-red-500">{uploadError}</p>
      )}
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
