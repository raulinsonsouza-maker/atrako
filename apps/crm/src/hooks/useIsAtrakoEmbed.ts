"use client";

import { useEffect, useState } from "react";

/** True quando o CRM roda dentro do iframe do shell Atrako. */
export function useIsAtrakoEmbed(): boolean {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      // cross-origin access to top throws — still means we're framed
      setEmbedded(true);
    }
  }, []);

  return embedded;
}
