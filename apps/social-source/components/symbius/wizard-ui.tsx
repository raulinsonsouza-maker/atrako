"use client";

import type { ReactNode } from "react";
import { useState } from "react";
import { Link2, X } from "lucide-react";

export function WizardLayout({
  form,
  previewHeader,
  preview,
}: {
  form: ReactNode;
  previewHeader: ReactNode;
  preview: ReactNode;
}) {
  return (
    <div className="symbius-light symbius-wizard-layout flex h-full min-h-0 flex-col overflow-hidden bg-[#eceef2] text-zinc-900 lg:flex-row">
      <div className="w-full shrink-0 overflow-y-auto border-b border-zinc-200/80 bg-white lg:h-full lg:max-h-full lg:w-[min(100%,400px)] lg:border-b-0 lg:border-r lg:shadow-[1px_0_0_rgba(0,0,0,0.04)]">
        <div className="px-5 py-5 md:px-6 md:py-6">{form}</div>
      </div>
      <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden bg-[#eceef2] lg:h-full">
        <div className="flex shrink-0 items-center justify-between border-b border-zinc-200/70 bg-[#eceef2] px-5 py-3.5 md:px-8">
          {previewHeader}
        </div>
        <div className="flex flex-1 items-start justify-center overflow-y-auto px-4 py-6 md:px-8 md:py-8">
          {preview}
        </div>
      </div>
    </div>
  );
}

export function WizardBackButton({
  onClick,
  children = "← Voltar",
}: {
  onClick: () => void;
  children?: ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="text-[13px] font-medium text-zinc-500 transition hover:text-zinc-800"
    >
      {children}
    </button>
  );
}

export function WizardTitle({ children }: { children: ReactNode }) {
  return (
    <h1 className="mt-2.5 text-[22px] font-semibold leading-snug tracking-tight text-zinc-900">
      {children}
    </h1>
  );
}

export function WizardSectionTitle({ children }: { children: ReactNode }) {
  return (
    <h2 className="text-[15px] font-semibold text-zinc-900">{children}</h2>
  );
}

export function WizardFieldLabel({ children }: { children: ReactNode }) {
  return (
    <label className="mb-1.5 block text-[11px] font-semibold uppercase tracking-wide text-zinc-400">
      {children}
    </label>
  );
}

export const wizardInputCls =
  "w-full rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] leading-snug text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/15";

export const wizardTextareaCls =
  "min-h-[88px] w-full resize-y rounded-lg border border-zinc-200 bg-white px-3 py-2 text-[13px] leading-relaxed text-zinc-900 outline-none transition placeholder:text-zinc-400 focus:border-[#0084ff] focus:ring-2 focus:ring-[#0084ff]/15";

export function ProBadge() {
  return (
    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider text-amber-700">
      PRO
    </span>
  );
}

function RadioDot({ selected }: { selected: boolean }) {
  return (
    <span
      className={`flex h-[18px] w-[18px] shrink-0 items-center justify-center rounded-full border-2 transition ${
        selected ? "border-[#0084ff]" : "border-zinc-300 bg-white"
      }`}
    >
      {selected ? (
        <span className="h-2 w-2 rounded-full bg-[#0084ff]" />
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
            ? "border-[#0084ff]/35 bg-[#f0f7ff] shadow-[inset_0_0_0_1px_rgba(0,132,255,0.08)]"
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
              <span className="text-[13px] font-medium leading-snug text-zinc-800">
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
      <span className="text-[13px] leading-snug text-zinc-800">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => !disabled && onChange(!checked)}
        className={`relative h-[22px] w-[38px] shrink-0 rounded-full transition ${
          checked ? "bg-[#0084ff]" : "bg-zinc-300"
        } ${disabled ? "cursor-not-allowed" : ""}`}
      >
        <span
          className={`absolute top-[2px] h-[18px] w-[18px] rounded-full bg-white shadow-sm transition ${
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
      className="rounded-md border border-zinc-200 bg-zinc-50 px-2.5 py-1 text-[11px] font-medium text-zinc-600 transition hover:border-[#0084ff]/40 hover:bg-[#f0f7ff] hover:text-[#0084ff]"
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
      className="rounded-lg bg-[#0084ff] px-4 py-2 text-[13px] font-semibold text-white shadow-sm transition hover:bg-[#0073e6] disabled:opacity-60"
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
          <span className="truncate text-[13px] font-medium text-zinc-800">
            {buttonLabel.trim() || "Acessar"}
          </span>
          <Link2 className="h-4 w-4 shrink-0 text-zinc-400" strokeWidth={1.75} />
        </button>
      ) : null}

      <button
        type="button"
        onClick={openModal}
        className="flex w-full items-center justify-center rounded-lg border border-dashed border-zinc-300 bg-white px-3 py-2.5 text-[13px] font-medium text-zinc-600 transition hover:border-[#0084ff]/40 hover:bg-[#f0f7ff] hover:text-[#0084ff]"
      >
        + Adicionar um link
      </button>

      {open ? (
        <div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/40 p-4"
          onClick={closeModal}
        >
          <div
            className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-3 border-b border-zinc-100 px-5 py-4">
              <h3 className="text-[15px] font-semibold text-zinc-900">
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
                className="rounded-lg border border-zinc-200 bg-white px-4 py-2 text-[13px] font-medium text-zinc-700 transition hover:bg-zinc-50"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={save}
                className="rounded-lg bg-[#0084ff] px-4 py-2 text-[13px] font-semibold text-white transition hover:bg-[#0073e6]"
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
