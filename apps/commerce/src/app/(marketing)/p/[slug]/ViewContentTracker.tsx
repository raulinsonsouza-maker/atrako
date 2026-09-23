"use client";

import { useEffect, useRef } from "react";
import {
  buildProductEventParams,
  trackMetaDual,
} from "@/components/meta/MetaPixel";

export function ViewContentTracker({
  productId,
  value,
  name,
}: {
  productId: string;
  value: number;
  name: string;
}) {
  const sent = useRef(false);

  useEffect(() => {
    if (sent.current) return;
    sent.current = true;
    trackMetaDual({
      eventName: "ViewContent",
      productId,
      params: buildProductEventParams({
        contentIds: [productId],
        value,
        contentName: name,
        contents: [{ id: productId, quantity: 1, item_price: value }],
      }),
      onceKey: `vc_${productId}`,
    });
  }, [productId, value, name]);

  return null;
}
