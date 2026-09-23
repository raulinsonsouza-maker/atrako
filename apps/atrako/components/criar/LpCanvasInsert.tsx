"use client";

import { useEffect, useId, useState } from "react";
import { Plus, X } from "lucide-react";
import { usePuck } from "@puckeditor/core";
import type { LpGoal } from "@/lib/criar/lp-schema";
import {
  LP_ELEMENT_LABELS,
  lpInsertableBlocks,
} from "@/lib/criar/puck/palette";

export type InsertableBlock = {
  type: string;
  label: string;
};

const BLOCK_LABELS: Record<string, string> = { ...LP_ELEMENT_LABELS };

export function insertablesForGoal(_goal?: LpGoal): InsertableBlock[] {
  return lpInsertableBlocks();
}

type PickerState = {
  index: number;
  zone: string;
} | null;

type PickerStore = {
  open: PickerState;
  listeners: Set<() => void>;
};

const g = globalThis as typeof globalThis & {
  __atrakoLpInsert?: PickerStore;
};

function getPickerStore(): PickerStore {
  if (!g.__atrakoLpInsert) {
    g.__atrakoLpInsert = { open: null, listeners: new Set() };
  }
  return g.__atrakoLpInsert;
}

function subscribePicker(listener: () => void) {
  const store = getPickerStore();
  store.listeners.add(listener);
  return () => {
    store.listeners.delete(listener);
  };
}

function getPickerOpen() {
  return getPickerStore().open;
}

export function openInsertPicker(index: number, zone: string) {
  const store = getPickerStore();
  store.open = { index, zone };
  store.listeners.forEach((l) => l());
}

function closeInsertPicker() {
  const store = getPickerStore();
  store.open = null;
  store.listeners.forEach((l) => l());
}

function useInsertPicker() {
  const [open, setOpen] = useState<PickerState>(getPickerOpen);
  useEffect(() => subscribePicker(() => setOpen(getPickerOpen())), []);
  return open;
}

function rootZoneFallback(contentZone?: string | null) {
  return contentZone || "root:default-zone";
}

/** Botão “Adicionar bloco” no canvas (estilo GreatPages). */
export function LpAddBlockButton({
  index,
  zone,
  variant = "between",
}: {
  index: number;
  zone: string;
  variant?: "between" | "top" | "empty";
}) {
  return (
    <div
      className={`lp-add-block-rail lp-add-block-rail--${variant}`}
      contentEditable={false}
    >
      <button
        type="button"
        className="lp-add-block-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          openInsertPicker(index, zone);
        }}
      >
        <Plus className="h-3.5 w-3.5" strokeWidth={2.25} aria-hidden />
        Adicionar bloco
      </button>
    </div>
  );
}

/** Overlay do bloco: label + trilhos de inserção. */
export function LpComponentOverlay({
  children,
  componentId,
  componentType,
  hover,
  isSelected,
}: {
  children: React.ReactNode;
  componentId: string;
  componentType: string;
  hover: boolean;
  isSelected: boolean;
}) {
  const { getSelectorForId } = usePuck();
  const selector = getSelectorForId(componentId);
  const zone = rootZoneFallback(selector?.zone);
  const index = selector?.index ?? 0;
  const show = hover || isSelected;
  const label = BLOCK_LABELS[componentType] || componentType;

  return (
    <div
      className="lp-block-overlay"
      data-hover={hover ? "true" : undefined}
      data-selected={isSelected ? "true" : undefined}
    >
      {show ? (
        <LpAddBlockButton index={index} zone={zone} variant="between" />
      ) : null}
      {isSelected ? (
        <div className="lp-block-overlay-tag type-micro-legal">{label}</div>
      ) : null}
      {children}
      {show ? (
        <LpAddBlockButton index={index + 1} zone={zone} variant="between" />
      ) : null}
    </div>
  );
}

/** Trilhos no topo/fim da página + picker modal. */
export function LpCanvasChrome({
  children,
  goal,
}: {
  children: React.ReactNode;
  goal: LpGoal;
}) {
  const { appState, dispatch, getSelectorForId } = usePuck();
  const open = useInsertPicker();
  const titleId = useId();
  const content = appState.data.content || [];
  const zone = rootZoneFallback(
    content[0]?.props?.id
      ? getSelectorForId(String(content[0].props.id))?.zone
      : null,
  );

  function insert(type: string) {
    if (!open) return;
    const id = `${type}-${Math.random().toString(36).slice(2, 9)}`;
    dispatch({
      type: "insert",
      componentType: type,
      destinationIndex: open.index,
      destinationZone: open.zone,
      id,
    });
    dispatch({
      type: "setUi",
      ui: {
        itemSelector: { index: open.index, zone: open.zone },
        rightSideBarVisible: true,
      },
    });
    closeInsertPicker();
  }

  const blocks = insertablesForGoal(goal);

  return (
    <>
      <div className="lp-canvas-chrome">
        <LpAddBlockButton index={0} zone={zone} variant="top" />
        <div className="lp-canvas-body">
          {children}
          {content.length === 0 ? (
            <div className="lp-canvas-empty" aria-hidden>
              <p className="type-caption-strong text-[var(--ink)]">
                Monte a sua página
              </p>
              <p className="mt-2 type-fine-print text-[var(--ink-muted-48)]">
                Clique em Adicionar bloco ou arraste da barra lateral.
              </p>
            </div>
          ) : null}
        </div>
        <LpAddBlockButton
          index={content.length}
          zone={zone}
          variant="top"
        />
      </div>

      {open ? (
        <div
          className="lp-insert-backdrop"
          role="dialog"
          aria-modal="true"
          aria-labelledby={titleId}
          onClick={(e) => {
            if (e.target === e.currentTarget) closeInsertPicker();
          }}
        >
          <div className="lp-insert-modal">
            <header className="lp-insert-modal-head">
              <h2 id={titleId} className="type-tagline text-[var(--ink)]">
                Adicionar bloco
              </h2>
              <button
                type="button"
                className="lp-insert-close"
                aria-label="Fechar"
                onClick={closeInsertPicker}
              >
                <X className="h-4 w-4" strokeWidth={1.75} />
              </button>
            </header>
            <div className="lp-insert-grid">
              {blocks.map((b) => (
                <button
                  key={b.type}
                  type="button"
                  className="lp-insert-option"
                  onClick={() => insert(b.type)}
                >
                  {b.label}
                </button>
              ))}
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
