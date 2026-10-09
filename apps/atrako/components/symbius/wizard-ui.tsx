"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Link2, X } from "lucide-react";
import { BackLink } from "@/components/ui/back-link";

/**
 * Formulário à esquerda + aparelho à direita (Social e Relacionamento).
 * `embedded`: dentro de uma página com rolagem própria (card com borda, sem altura fixa).
 */
export function WizardLayout({
  form,
  previewHeader,
  preview,
  embedded = false,
  wideForm = false,
}: {
  form: ReactNode;
  previewHeader?: ReactNode;
  preview: ReactNode;
  embedded?: boolean;
  wideForm?: boolean;
}) {
  return (
    <div
      className={`symbius-light symbius-wizard-layout flex min-h-0 flex-col bg-[var(--canvas-parchment)] text-[var(--ink)] lg:flex-row ${
        embedded ? "overflow-hidden rounded-[var(--radius-lg)] border border-[var(--hairline)]" : "h-full overflow-hidden"
      }`}
    >
      <div
        className={`w-full shrink-0 border-b border-[var(--hairline)] bg-[var(--canvas)] lg:border-b-0 lg:border-r ${
          embedded ? "" : "overflow-y-auto lg:h-full lg:max-h-full"
        } ${wideForm ? "lg:w-[min(100%,560px)] xl:w-[min(100%,640px)]" : "lg:w-[min(100%,400px)]"}`}
      >
        <div className="px-5 py-5 md:px-6 md:py-6">{form}</div>
      </div>
      <div className={`flex min-h-0 min-w-0 flex-1 flex-col bg-[var(--canvas-parchment)] ${embedded ? "" : "overflow-hidden lg:h-full"}`}>
        {previewHeader ? (
          <div className="flex shrink-0 items-center justify-between border-b border-[var(--hairline)] px-5 py-3.5 md:px-8">{previewHeader}</div>
        ) : null}
        <div className={`flex flex-1 items-start justify-center px-4 py-6 md:px-8 md:py-8 ${embedded ? "lg:sticky lg:top-0" : "overflow-y-auto"}`}>
          {preview}
        </div>
      </div>
    </div>
  );
}

export function WizardBackButton({
  onClick,
  children = "Voltar",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return <BackLink onClick={onClick}>{children}</BackLink>;
}

export function WizardTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2.5 type-tagline leading-snug text-zinc-900">
      {children}
    </h1>
  );
}

export function WizardSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="type-body-strong text-zinc-900">{children}</h2>
  );
}

export function WizardFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block type-caption-strong uppercase text-zinc-400">
      {children}
    </label>
  );
}

export const wizardInputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 type-caption leading-snug text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]";

export const wizardTextareaCls =
  "min-h-[88px] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 type-caption leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[var(--primary)] focus:ring-2 focus:ring-[var(--primary-glow)]";

export function ProBadge() {
  return (
    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 type-micro-legal uppercase text-amber-700">
      PRO
    </span>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${
        selected ? "border-[var(--primary)]" : "border-zinc-300 bg-white"
      }`}
    >
      {selected ? (
        <span className="h-2 w-2 rounded-full bg-[var(--primary)]" />
      ) : null}
    </span>
  );
}

export function RadioOption({
  selected,
  disabled,
  pro,
  title,
  children,
  onClick,
}: {
  selected: boolean;
  disabled?: boolean;
  pro?: boolean;
  title: string;
  children?: ReactNode;
  onClick?: () => void;
}) {
  return (
    <div
      className={`rounded-xl border transition ${
        disabled
          ? "border-zinc-200/80 bg-zinc-50/80 opacity-55"
          : selected
            ? "border-[var(--primary)] bg-[var(--canvas-parchment)]"
            : "border-zinc-200 bg-white hover:border-zinc-300"
      }`}
    >
      <button
        type="button"
        disabled={disabled}
        onClick={onClick}
        className={`w-full px-3.5 py-3 text-left ${
          disabled ? "cursor-not-allowed" : "cursor-pointer"
        }`}
      >
        <span className="flex items-start gap-3">
          <RadioDot selected={selected && !disabled} />
          <span className="min-w-0 flex-1">
            <span className="flex min-h-[18px] items-center justify-between gap-2">
              <span className="type-caption font-normal leading-snug text-zinc-800">
                {title}
              </span>
              {pro ? <ProBadge /> : null}
            </span>
            {selected && children ? (
              <div
                className="mt-2.5 space-y-2"
                onClick={(e) => e.stopPropagation()}
              >
                {children}
              </div>
            ) : null}
          </span>
        </span>
      </button>
    </div>
  );
}

export function ToggleRow({
  label,
  checked,
  onChange,
  disabled,
  bare,
}: {
  label: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  disabled?: boolean;
  bare?: boolean;
}) {
  return (
    <label
      className={`flex items-center justify-between gap-3 ${
        bare
          ? ""
          : `rounded-xl border border-zinc-200 bg-white px-3.5 py-2.5 ${
              disabled ? "opacity-55" : "cursor-pointer"
            }`
      } ${!bare && disabled ? "opacity-55" : !bare ? "cursor-pointer" : ""}`}
    >
      <span className="type-caption leading-snug text-zinc-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${
          checked ? "bg-[var(--primary)]" : "bg-zinc-300"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white transition ${
            checked ? "left-[18px]" : "left-[2px]"
          }`}
        />
      </button>
    </label>
  );
}

export function TagChip({
  children,
  onClick,
}: {
  children: ReactNode;
  onClick?: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 type-fine-print font-normal text-zinc-600 transition hover:border-[var(--primary)] hover:bg-[var(--canvas-parchment)] hover:text-[var(--primary)]"
    >
      {children}
    </button>
  );
}

export function ActivateButton({
  loading,
  onClick,
  label = "Ativar",
}: {
  loading?: boolean;
  onClick: () => void;
  label?: string;
}) {
  return (
    <button
      type="button"
      disabled={loading}
      onClick={onClick}
      className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-white transition hover:bg-[var(--primary-focus)] disabled:opacity-60"
    >
      {loading ? "Ativando…" : label}
    </button>
  );
}

export function WizardLinkButtonEditor({
  buttonLabel,
  url,
  onChange,
}: {
  buttonLabel: string;
  url: string;
  onChange: (button: string, url: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [draftButton, setDraftButton] = useState(buttonLabel);
  const [draftUrl, setDraftUrl] = useState(url);

  function openModal() {
    setDraftButton(buttonLabel.trim() || "Acessar");
    setDraftUrl(url);
    setOpen(true);
  }

  function closeModal() {
    setOpen(false);
  }

  function save() {
    const nextButton = draftButton.trim() || "Acessar";
    const nextUrl = draftUrl.trim();
    if (!nextUrl) {
      alert("Informe o link");
      return;
    }
    onChange(nextButton, nextUrl);
    closeModal();
  }

  const hasLink = Boolean(url.trim());

  return (
    <>
      {hasLink ? (
        <button
          type="button"
          onClick={openModal}
          className="flex w-full items-center justify-between gap-3 rounded-lg border border-zinc-200 bg-zinc-50/80 px-3.5 py-2.5 text-left transition hover:border-zinc-300 hover:bg-zinc-50"
        >
          <span className="truncate type-caption font-normal text-zinc-800">
            {buttonLabel.trim() || "Acessar"}
          </span>
          <Link2 className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2.5 type-caption font-normal text-zinc-600 transition hover:border-[var(--primary)] hover:bg-[var(--canvas-parchment)] hover:text-[var(--primary)]"
      >
        + Adicionar um link
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <h3 className="type-body-strong text-zinc-900">
                Adicionar um link
              </h3>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700"
                aria-label="Fechar"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-5 py-4">
              <div>
                <WizardFieldLabel>Texto do botão</WizardFieldLabel>
                <input
                  value={draftButton}
                  onChange={(e) => setDraftButton(e.target.value)}
                  className={wizardInputCls}
                  placeholder="Adicione legenda ao botão, por exemplo, 'Abrir'"
                  autoFocus
                />
              </div>
              <div>
                <WizardFieldLabel>Link</WizardFieldLabel>
                <input
                  value={draftUrl}
                  onChange={(e) => setDraftUrl(e.target.value)}
                  className={wizardInputCls}
                  placeholder="https://"
                  inputMode="url"
                />
              </div>
            </div>

            <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-[var(--radius-xs)] border border-zinc-200 bg-white px-4 py-2 type-caption font-normal text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-[var(--radius-xs)] bg-[var(--primary)] px-4 py-2 type-caption-strong text-white transition hover:bg-[var(--primary-focus)]"
              >
                Salvar
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
