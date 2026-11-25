"use client";

import { useState } from "react";

type Item = { q: string; a: string };

type Props = {
  title?: string;
  items: Item[];
};

/** FAQ interativo — um item aberto por vez. */
export function LpFaqAccordion({ title = "Perguntas frequentes", items }: Props) {
  const [open, setOpen] = useState(0);

  return (
    <section className="lp-faq" aria-label={title}>
      <h2 className="lp-faq__title type-caption-strong text-[var(--ink)]">{title}</h2>
      <div className="lp-faq__list">
        {items.map((item, i) => {
          const isOpen = open === i;
          return (
            <div key={`${i}-${item.q}`} className={`lp-faq__item${isOpen ? " is-open" : ""}`}>
              <button
                type="button"
                className="lp-faq__q"
                aria-expanded={isOpen}
                onClick={() => setOpen(isOpen ? -1 : i)}
              >
                <span className="type-caption-strong text-[var(--ink)]">{item.q}</span>
                <span className="lp-faq__icon" aria-hidden>
                  {isOpen ? "−" : "+"}
                </span>
              </button>
              {isOpen ? <p className="lp-faq__a type-caption text-[var(--ink-muted-80)]">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
