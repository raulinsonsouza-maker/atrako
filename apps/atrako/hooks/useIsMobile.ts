"use client";

import { useEffect, useState } from "react";

/** Mesmo corte do `md` do Tailwind (sidebar vira gaveta). Começa `false` para o SSR bater com o desktop. */
export const MOBILE_QUERY = "(max-width: 767.98px)";

export function useIsMobile() {
  const [mobile, setMobile] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia(MOBILE_QUERY);
    const update = () => setMobile(mq.matches);
    update();
    mq.addEventListener("change", update);
    return () => mq.removeEventListener("change", update);
  }, []);
  return mobile;
}
