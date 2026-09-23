"use client";

import { useEffect, useState } from "react";
import { Check, Copy } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export function CopyLinkButton({
  url,
  className,
  label = "Copiar link",
}: {
  url: string;
  className?: string;
  label?: string;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* ignore */
    }
  }

  return (
    <Button
      type="button"
      variant="primary"
      onClick={() => void copy()}
      className={cn("!gap-2", className)}
    >
      {copied ? <Check className="h-4 w-4" strokeWidth={2} /> : <Copy className="h-4 w-4" strokeWidth={1.75} />}
      {copied ? "Copiado" : label}
    </Button>
  );
}

export function UrlPreview({ path, className }: { path: string; className?: string }) {
  const [origin, setOrigin] = useState("");
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const full = `${origin || ""}${path.startsWith("/") ? path : `/${path}`}`;
  return (
    <p
      className={cn(
        "truncate rounded-[var(--radius-xs)] border border-[var(--hairline)] bg-[var(--surface-chip-translucent)] px-4 py-2.5 type-caption text-[var(--ink-muted-80)]",
        className,
      )}
      title={full || path}
    >
      {origin ? full : path}
    </p>
  );
}

/** Chip de URL com copiar — lista de páginas (estilo GreatPages). */
export function UrlChip({
  path,
  className,
}: {
  path: string;
  className?: string;
}) {
  const [origin, setOrigin] = useState("");
  const [copied, setCopied] = useState(false);
  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);
  const full = `${origin || ""}${path.startsWith("/") ? path : `/${path}`}`;
  const display = origin ? full.replace(/^https?:\/\//, "") : path;

  async function copy() {
    try {
      await navigator.clipboard.writeText(full || path);
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={cn("lp-url-chip", className)}
      title={full || path}
    >
      <ExternalLinkIcon />
      <span className="lp-url-chip-text">{display}</span>
      <button
        type="button"
        className="lp-url-chip-copy"
        onClick={() => void copy()}
        aria-label={copied ? "Copiado" : "Copiar URL"}
      >
        {copied ? (
          <Check className="h-3.5 w-3.5" strokeWidth={2} />
        ) : (
          <Copy className="h-3.5 w-3.5" strokeWidth={1.75} />
        )}
      </button>
    </div>
  );
}

function ExternalLinkIcon() {
  return (
    <svg
      className="lp-url-chip-link"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.75"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}
