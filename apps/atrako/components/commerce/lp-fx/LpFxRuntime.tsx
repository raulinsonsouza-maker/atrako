"use client";

import dynamic from "next/dynamic";
import { useLayoutEffect, useState, type ComponentType } from "react";
import { VANILLA_FX } from "./vanilla";

const FANCY: Record<string, ComponentType<{ el: HTMLElement }>> = {
  "text-rotate": dynamic(() => import("./fancy/text-rotate").then((m) => m.TextRotate), { ssr: false }),
  "cut-reveal": dynamic(() => import("./fancy/vertical-cut-reveal").then((m) => m.CutReveal), { ssr: false }),
  scramble: dynamic(() => import("./fancy/scramble-in").then((m) => m.ScrambleIn), { ssr: false }),
  typewriter: dynamic(() => import("./fancy/typewriter").then((m) => m.Typewriter), { ssr: false }),
  counter: dynamic(() => import("./fancy/basic-number-ticker").then((m) => m.NumberTicker), { ssr: false }),
  highlight: dynamic(() => import("./fancy/text-highlighter").then((m) => m.TextHighlighter), { ssr: false }),
  "letter-swap": dynamic(() => import("./fancy/letter-swap").then((m) => m.LetterSwap), { ssr: false }),
  marquee: dynamic(() => import("./fancy/simple-marquee").then((m) => m.SimpleMarquee), { ssr: false }),
  stack: dynamic(() => import("./fancy/stacking-cards").then((m) => m.StackingCards), { ssr: false }),
  float: dynamic(() => import("./fancy/float").then((m) => m.Float), { ssr: false }),
};

type Item = { key: string; fx: string; el: HTMLElement };

/**
 * Hidrata [data-fx] dentro do HTML da LP. Não substitui os portais de formulário e checkout.
 */
export function LpFxRuntime({ root, html }: { root: HTMLElement | null; html: string }) {
  const [items, setItems] = useState<Item[]>([]);

  useLayoutEffect(() => {
    if (!root) {
      setItems([]);
      return;
    }
    const els = [...root.querySelectorAll<HTMLElement>("[data-fx]")];
    const cleanups = els.flatMap((el) => {
      const fx = el.getAttribute("data-fx") || "";
      const attach = VANILLA_FX[fx];
      return attach ? [attach(el)] : [];
    });
    setItems(
      els
        .map((el, index) => ({ key: `${el.getAttribute("data-fx")}-${index}`, fx: el.getAttribute("data-fx") || "", el }))
        .filter((item) => FANCY[item.fx]),
    );
    return () => {
      for (const cleanup of cleanups) cleanup();
      setItems([]);
    };
  }, [root, html]);

  return (
    <>
      {items.map((item) => {
        const Comp = FANCY[item.fx];
        return <Comp key={item.key} el={item.el} />;
      })}
    </>
  );
}
