"use client";

import { ReactNode, MouseEvent } from "react";

/** Scroll suave até o formulário e foca o campo Nome (mobile-first). */
export function LpCheckoutLink({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  function onClick(e: MouseEvent<HTMLAnchorElement>) {
    const form = document.getElementById("checkout-form");
    const section = document.getElementById("checkout");
    const target = form ?? section;
    if (!target) return;

    e.preventDefault();
    target.scrollIntoView({ behavior: "smooth", block: "start" });
    window.history.replaceState(null, "", "#checkout");

    window.setTimeout(() => {
      const input = document.getElementById("name") as HTMLInputElement | null;
      input?.focus({ preventScroll: true });
    }, 450);
  }

  return (
    <a href="#checkout" className={className} onClick={onClick}>
      {children}
    </a>
  );
}
