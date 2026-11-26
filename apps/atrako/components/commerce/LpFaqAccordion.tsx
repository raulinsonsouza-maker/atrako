"use client";

import { useState } from "react";

type Item = { q: string; a: string };

type Props = {
  title?: string;
  items: Item[];
};

/** FAQ interativo — um item aberto por vez. */
export function LpFaqAccordion({ title, items }: Props) {
  const [open, setOpen] = useState(0);

  return (
    <section className="lp-faq" aria-label={title || "Perguntas frequentes"}>
      {title ? <h2 className="lp-faq__title">{title}</h2> : null}
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
                <span>{item.q}</span>
                <span className="lp-faq__icon" aria-hidden>
                  {isOpen ? "∧" : "∨"}
                </span>
              </button>
              {isOpen ? <p className="lp-faq__a">{item.a}</p> : null}
            </div>
          );
        })}
      </div>
    </section>
  );
}
