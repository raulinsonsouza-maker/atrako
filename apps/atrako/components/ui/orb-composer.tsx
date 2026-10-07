"use client";

import * as React from "react";
import { ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";

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
      className,
      "aria-label": ariaLabel = "Pergunte ao Atrako",
    },
    ref,
  ) => {
    const formRef = React.useRef<HTMLFormElement>(null);
    const fieldRef = React.useRef<HTMLTextAreaElement>(null);
    const sendRef = React.useRef<HTMLButtonElement>(null);
    const timers = React.useRef<{ typing?: number; shake?: number }>({});
    const [multiline, setMultiline] = React.useState(false);

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
      if (busy) return;
      const text = value.trim();
      if (!text) {
        flag("data-shake", 260, "shake");
        return;
      }
      onSubmit(text);
    };

    const ready = value.trim().length > 0 && !busy;

    return (
      <form
        ref={formRef}
        className={cn("orb-composer", className)}
        data-busy={busy || undefined}
        data-multiline={multiline || undefined}
        onSubmit={(e) => {
          e.preventDefault();
          submit();
        }}
        autoComplete="off"
      >
        <span className="orb-composer-ring" aria-hidden />
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
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey && !e.nativeEvent.isComposing) {
              e.preventDefault();
              submit();
            }
          }}
        />
        {actions ? <div className="orb-composer-actions">{actions}</div> : null}
        <button
          ref={sendRef}
          type="submit"
          className="orb-composer-send"
          aria-label="Enviar"
          data-ready={ready || undefined}
          disabled={busy}
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
