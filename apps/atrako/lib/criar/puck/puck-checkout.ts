import type { Data } from "@puckeditor/core";

/** IDs de checkout referenciados nos blocos Checkout do puck. */
export function checkoutProductIdsFromPuck(
  data: Data | null | undefined,
): string[] {
  if (!data?.content?.length) return [];
  const ids = new Set<string>();
  for (const block of data.content) {
    if (block.type !== "AtrakoCheckout") continue;
    const pid = block.props?.productId;
    if (typeof pid === "string" && pid.trim()) ids.add(pid.trim());
  }
  return [...ids];
}

/** Primeiro checkout ligado a um bloco (para sync em salesPage). */
export function firstCheckoutProductIdFromPuck(
  data: Data | null | undefined,
): string | undefined {
  return checkoutProductIdsFromPuck(data)[0];
}

/** IDs de formulário nos blocos Form e Hero (split-form). */
export function formIdsFromPuck(data: Data | null | undefined): string[] {
  if (!data?.content?.length) return [];
  const ids = new Set<string>();
  for (const block of data.content) {
    if (block.type === "AtrakoForm" || block.type === "Hero") {
      const fid = block.props?.formId;
      if (typeof fid === "string" && fid.trim()) ids.add(fid.trim());
    }
  }
  return [...ids];
}

/** Primeiro formId nos blocos (para sync em salesPage). */
export function firstFormIdFromPuck(
  data: Data | null | undefined,
): string | undefined {
  return formIdsFromPuck(data)[0];
}

export function puckHasBlockType(
  data: Data | null | undefined,
  type: string,
): boolean {
  return Boolean(data?.content?.some((c) => c.type === type));
}

/** Bloco Checkout sem productId (bloqueia publish). */
export function puckHasUnresolvedCheckout(
  data: Data | null | undefined,
): boolean {
  if (!data?.content?.length) return false;
  return data.content.some(
    (c) =>
      c.type === "AtrakoCheckout" &&
      !(typeof c.props?.productId === "string" && c.props.productId.trim()),
  );
}
