"use client";

import * as React from "react";
import { ArrowUp, FileText, Film, Paperclip, X } from "lucide-react";
import { cn } from "@/lib/utils";

export type ComposerFile = {
  id: string;
  name: string;
  kind: "image" | "document" | "video";
  previewUrl?: string;
  status: "uploading" | "ready" | "error";
};

const ACCEPT = "image/png,image/jpeg,image/webp,image/gif,.pdf,.txt,.md,.csv,.docx,video/mp4,video/webm";

export interface OrbComposerHandle {
  focus(): void;
  /** Posição do botão enviar — origem da bola que voa até o orb. */
  sendRect(): DOMRect | null;
}

export interface OrbComposerProps {
  value: string;
  onValueChange: (value: string) => void;
  onSubmit: (text: string) => void;
  busy?: boolean;
  placeholder?: string;
  autoFocus?: boolean;
  /** Chips entre o campo e o enviar (ex.: modo Pensar). */
  actions?: React.ReactNode;
  /** Arquivos já escolhidos, antes do envio. */
  files?: ComposerFile[];
  onFiles?: (files: File[]) => void;
  onRemoveFile?: (id: string) => void;
  className?: string;
  "aria-label"?: string;
}

const MAX_FIELD_H = 200;
/** Mantém em sincronia com `.orb-composer-field { line-height }`. */
const FIELD_LINE_H = 24;

/**
 * Campo de pergunta do assistente (YAML: orb-composer). Pílula com anel girando em `--primary`
 * no foco / digitando / enviando. Enter envia, Shift+Enter quebra linha.
 */
const OrbComposer = React.forwardRef<OrbComposerHandle, OrbComposerProps>(
  (
    {
      value,
      onValueChange,
      onSubmit,
      busy = false,
      placeholder = "Pergunte qualquer coisa",
      autoFocus = false,
      actions,
      files = [],
      onFiles,
      onRemoveFile,
      className,
      "aria-label": ariaLabel = "Pergunte ao Atrako",
    },
    ref,
  ) => {
    const formRef = React.useRef<HTMLFormElement>(null);
    const fieldRef = React.useRef<HTMLTextAreaElement>(null);
    const fileRef = React.useRef<HTMLInputElement>(null);
    const sendRef = React.useRef<HTMLButtonElement>(null);
    const timers = React.useRef<{ typing?: number; shake?: number }>({});
    const [multiline, setMultiline] = React.useState(false);
    const [dragOver, setDragOver] = React.useState(false);
    const uploading = files.some((file) => file.status === "uploading");
    const hasFiles = files.some((file) => file.status === "ready");

    React.useImperativeHandle(ref, () => ({
      focus: () => fieldRef.current?.focus({ preventScroll: true }),
      sendRect: () => sendRef.current?.getBoundingClientRect() ?? null,
    }));

    React.useLayoutEffect(() => {
      const el = fieldRef.current;
      if (!el) return;
      el.style.height = "auto";
      const h = Math.min(el.scrollHeight, MAX_FIELD_H);
      el.style.height = `${h}px`;
      el.style.overflowY = el.scrollHeight > MAX_FIELD_H ? "auto" : "hidden";
      setMultiline(h > FIELD_LINE_H + 4);
    }, [value]);

    React.useEffect(() => {
      if (autoFocus) fieldRef.current?.focus({ preventScroll: true });
      const t = timers.current;
      return () => {
        window.clearTimeout(t.typing);
        window.clearTimeout(t.shake);
      };
    }, [autoFocus]);

    const flag = (name: "data-typing" | "data-shake", ms: number, key: "typing" | "shake") => {
      const form = formRef.current;
      if (!form) return;
      if (name === "data-shake") {
        form.removeAttribute(name);
        void form.offsetWidth;
      }
      form.setAttribute(name, "");
      window.clearTimeout(timers.current[key]);
      timers.current[key] = window.setTimeout(() => form.removeAttribute(name), ms);
    };

    const submit = () => {
      if (busy || uploading) return;
      const text = value.trim();
      if (!text && !hasFiles) {
        flag("data-shake", 260, "shake");
        return;
      }
      onSubmit(text);
    };

    const takeFiles = (list: FileList | File[] | null) => {
      const picked = list ? [...list] : [];
      if (picked.length) onFiles?.(picked);
    };

    const ready = (value.trim().length > 0 || hasFiles) && !busy && !uploading;

    return (
      <form
        ref={formRef}
        className={cn("orb-composer", className)}
        data-busy={busy || undefined}
        data-multiline={multiline || files.length > 0 || undefined}
        data-files={files.length > 0 || undefined}
        data-drop={dragOver || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        onDragOver={(e) => {
          if (!e.dataTransfer.types.includes("Files")) return;
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          if (!e.dataTransfer.files.length) return;
          e.preventDefault();
          setDragOver(false);
          takeFiles(e.dataTransfer.files);
        }}
        autoComplete="off"
      >
        <span className="orb-composer-ring" aria-hidden />
        <button
          type="button"
          className="orb-composer-clip"
          aria-label="Anexar arquivo"
          disabled={busy}
          onClick={() => fileRef.current?.click()}
        >
          <Paperclip className="h-4 w-4" strokeWidth={1.75} />
        </button>
        <input
          ref={fileRef}
          className="orb-composer-file-input"
          type="file"
          multiple
          accept={ACCEPT}
          hidden
          tabIndex={-1}
          onChange={(e) => {
            takeFiles(e.target.files);
            e.target.value = "";
          }}
        />
        <div className="orb-composer-main">
          {files.length ? (
            <div className="orb-composer-files">
              {files.map((file) => (
                <span key={file.id} className="orb-composer-file type-caption" data-status={file.status}>
                  {file.kind === "image" && file.previewUrl ? (
                    // preview local, antes do envio
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={file.previewUrl} alt="" />
                  ) : file.kind === "video" ? (
                    <Film className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  ) : (
                    <FileText className="h-4 w-4" strokeWidth={1.75} aria-hidden />
                  )}
                  <span className="orb-composer-file-name">{file.status === "uploading" ? "Enviando…" : file.name}</span>
                  <button type="button" aria-label={`Tirar ${file.name}`} onClick={() => onRemoveFile?.(file.id)}>
                    <X className="h-3.5 w-3.5" strokeWidth={1.75} />
                  </button>
                </span>
              ))}
            </div>
          ) : null}
          <textarea
            ref={fieldRef}
            className="orb-composer-field type-body"
            rows={1}
            value={value}
            placeholder={placeholder}
            aria-label={ariaLabel}
            spellCheck={false}
            onChange={(e) => {
              onValueChange(e.target.value);
              flag("data-typing", 300, "typing");
            }}
            onPaste={(e) => {
              const pasted = [...e.clipboardData.files];
              if (!pasted.length) return;
              e.preventDefault();
              takeFiles(pasted);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
                e.preventDefault();
                submit();
              }
            }}
          />
        </div>
        {actions ? <div className="orb-composer-actions">{actions}</div> : null}
        <button
          ref={sendRef}
          type="submit"
          className="orb-composer-send"
          aria-label="Enviar"
          data-ready={ready || undefined}
          disabled={busy || uploading}
        >
          {busy ? <span className="orb-composer-busy" aria-hidden /> : <ArrowUp className="h-4 w-4" strokeWidth={2} />}
        </button>
      </form>
    );
  },
);
OrbComposer.displayName = "OrbComposer";

export interface OrbComposerChipProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  pressed?: boolean;
}

/** Chip liga/desliga dentro do composer (ex.: Pensar). */
const OrbComposerChip = React.forwardRef<HTMLButtonElement, OrbComposerChipProps>(
  ({ pressed = false, className, ...props }, ref) => (
    <button
      ref={ref}
      type="button"
      aria-pressed={pressed}
      className={cn("orb-composer-chip type-caption", className)}
      {...props}
    />
  ),
);
OrbComposerChip.displayName = "OrbComposerChip";

export { OrbComposer, OrbComposerChip };
