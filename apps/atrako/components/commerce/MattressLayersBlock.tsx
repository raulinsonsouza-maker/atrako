"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";

export type MattressLayer = {
  id: number;
  title: string;
  body?: string;
  imageUrl: string;
};

type Props = {
  title?: string;
  layers: MattressLayer[];
};

/** Diagrama interativo de camadas (port fiel do bloco Pikolin `block-layers`). */
export function MattressLayersBlock({ title, layers }: Props) {
  const sorted = [...layers].sort((a, b) => a.id - b.id);
  const [activeId, setActiveId] = useState(sorted[0]?.id ?? 1);
  const [viewed, setViewed] = useState(false);
  const groupRef = useRef<HTMLUListElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) setViewed(true);
      },
      { threshold: 0.25 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  function selectLayer(id: number) {
    setActiveId(id);
    if (typeof window !== "undefined" && window.innerWidth <= 767) {
      requestAnimationFrame(() => {
        panelRef.current?.scrollIntoView({ behavior: "smooth", block: "nearest" });
      });
    }
  }

  if (!sorted.length) return null;

  const active = sorted.find((l) => l.id === activeId) ?? sorted[0];
  const count = sorted.length;

  return (
    <section className="mattress-layers" aria-label={title || "Camadas do colchão"}>
      {title ? <h2 className="mattress-layers__title type-caption-strong text-[var(--ink)]">{title}</h2> : null}
      <div className="mattress-layers__row">
        <div className="mattress-layers__diagram">
          <ul
            ref={groupRef}
            className={`mattress-layers__group${viewed ? " is-viewed" : ""}`}
            id="mattress-layers-accordion"
          >
            {sorted.map((layer, index) => {
              const zIndex = count - index;
              const active = layer.id === activeId;
              return (
                <li
                  key={layer.id}
                  className={`mattress-layers__item${active ? " is-out" : ""}`}
                  data-id={layer.id}
                  style={
                    {
                      ["--item-bg"]: `url(${layer.imageUrl})`,
                      ["--item-index"]: String(zIndex),
                    } as CSSProperties
                  }
                  onClick={() => selectLayer(layer.id)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      selectLayer(layer.id);
                    }
                  }}
                  role="button"
                  tabIndex={0}
                  aria-pressed={active}
                  aria-label={`Camada ${layer.id}: ${layer.title}`}
                >
                  <span className="mattress-layers__count">{layer.id}</span>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mattress-layers__content" ref={panelRef}>
          {sorted.map((layer) => (
            <div
              key={layer.id}
              className={`mattress-layers__panel${layer.id === active.id ? " is-visible" : ""}`}
              hidden={layer.id !== active.id}
            >
              <h3 className="type-body-strong text-[var(--ink)]">{layer.title}</h3>
              {layer.body ? <p className="type-body text-[var(--ink-muted-80)]">{layer.body}</p> : null}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
