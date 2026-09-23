"use client";

import { useEffect, useState } from "react";

/** True quando o Social roda no iframe do shell Atrako. */
export function useIsAtrakoEmbed(): boolean {
  const [embedded, setEmbedded] = useState(false);

  useEffect(() => {
    try {
      setEmbedded(window.self !== window.top);
    } catch {
      setEmbedded(true);
    }
  }, []);

  return embedded;
}
