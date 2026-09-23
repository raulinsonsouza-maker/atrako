"use client";

import { useEffect, useRef } from "react";
import {
  buildProductEventParams,
  trackMeta,
  type MetaContentItem,
} from "@/components/meta/MetaPixel";

export function PurchaseTracker({
  eventId,
  value,
  contentIds,
  contentName,
  contents,
  status,
}: {
  eventId?: string | null;
  value: number;
  contentIds: string[];
  contentName?: string;
  contents?: MetaContentItem[];
  status: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (!eventId || status !== "APPROVED" || sent.current) return;
    sent.current = true;

    const onceKey = `purchase_${eventId}`;
    try {
      if (sessionStorage.getItem(`meta_${onceKey}`)) return;
      sessionStorage.setItem(`meta_${onceKey}`, "1");
    } catch {
      // ignore
    }

    trackMeta(
      "Purchase",
      buildProductEventParams({
        contentIds,
        value,
        contentName,
        contents:
          contents ??
          contentIds.map((id) => ({
            id,
            quantity: 1,
            item_price: value / Math.max(contentIds.length, 1),
          })),
      }),
      eventId,
    );
  }, [eventId, value, contentIds, contentName, contents, status]);

  return null;
}
