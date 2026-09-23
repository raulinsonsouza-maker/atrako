"use client";

import { useEffect, useState } from "react";
import { formatBRL } from "@/lib/utils";
import { LpCheckoutLink } from "./LpCheckoutLink";

export function LpStickyCta({
  priceCents,
  ctaLabel = "Quero agora",
}: {
  priceCents: number;
  ctaLabel?: string;
}) {
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const checkout = document.getElementById("checkout");
    const heroCta = document.getElementById("lp-hero-cta");
    if (!checkout) return;

    let checkoutInView = false;
    let heroCtaInView = true;

    const sync = () => {
      // Só aparece depois que o CTA do hero saiu da tela, e some no checkout
      setVisible(!heroCtaInView && !checkoutInView);
    };

    const checkoutObs = new IntersectionObserver(
      ([entry]) => {
        checkoutInView = entry.isIntersecting;
        sync();
      },
      { root: null, threshold: 0.12, rootMargin: "0px 0px -8% 0px" },
    );
    checkoutObs.observe(checkout);

    let heroObs: IntersectionObserver | null = null;
    if (heroCta) {
      heroObs = new IntersectionObserver(
        ([entry]) => {
          heroCtaInView = entry.isIntersecting;
          sync();
        },
        { root: null, threshold: 0, rootMargin: "0px 0px -12% 0px" },
      );
      heroObs.observe(heroCta);
    } else {
      heroCtaInView = false;
      sync();
    }

    return () => {
      checkoutObs.disconnect();
      heroObs?.disconnect();
    };
  }, []);

  return (
    <div
      className="lp-sticky"
      data-hidden={visible ? "false" : "true"}
      aria-hidden={!visible}
    >
      <div className="lp-sticky__price">
        <strong>{formatBRL(priceCents)}</strong>
        <span>no PIX</span>
      </div>
      <LpCheckoutLink className="lp-cta">{ctaLabel}</LpCheckoutLink>
    </div>
  );
}
