"use client";

import { useEffect, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { clsx } from "clsx";

export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: ReactNode;
  footer?: ReactNode;
  size?: "sm" | "md" | "lg" | "xl";
}

const sizeClasses = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({ open, onClose, title, children, footer, size = "md" }: ModalProps) {
  useEffect(() => {
    const onEscape = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    if (open) {
      document.addEventListener("keydown", onEscape);
      document.body.style.overflow = "hidden";
    }
    return () => {
      document.removeEventListener("keydown", onEscape);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const content = (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby={title ? "modal-title" : undefined}
    >
      {/* Overlay */}
      <div
        className={clsx(
          "absolute inset-0",
          "bg-neutral-900/40 dark:bg-black/60",
          "backdrop-blur-sm",
          "animate-fade-in"
        )}
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Content */}
      <div
        className={clsx(
          "relative w-full overflow-hidden",
          "rounded-2xl",
          "bg-white/95 dark:bg-neutral-900/95",
          "backdrop-blur-xl backdrop-saturate-150",
          "border border-neutral-200/50 dark:border-neutral-700/50",
          "shadow-modal",
          "animate-modal-in",
          sizeClasses[size]
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div
          className={clsx(
            "flex items-center justify-between px-5 py-4",
            "border-b border-neutral-200/60 dark:border-neutral-700/60"
          )}
        >
          {title ? (
            <h2
              id="modal-title"
              className="text-headline font-semibold text-neutral-900 dark:text-neutral-100"
            >
              {title}
            </h2>
          ) : (
            <span />
          )}
          <button
            type="button"
            onClick={onClose}
            aria-label="Fechar"
            className={clsx(
              "flex h-7 w-7 items-center justify-center rounded-full",
              "bg-neutral-100/80 dark:bg-neutral-800/80",
              "text-neutral-500 dark:text-neutral-400",
              "hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80",
              "hover:text-neutral-700 dark:hover:text-neutral-200",
              "transition-all duration-fast"
            )}
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4">{children}</div>

        {/* Footer */}
        {footer && (
          <div
            className={clsx(
              "flex items-center justify-end gap-2 px-5 py-4",
              "border-t border-neutral-200/60 dark:border-neutral-700/60",
              "bg-neutral-50/50 dark:bg-neutral-800/30"
            )}
          >
            {footer}
          </div>
        )}
      </div>
    </div>
  );

  if (typeof document !== "undefined") {
    return createPortal(content, document.body);
  }
  return null;
}
