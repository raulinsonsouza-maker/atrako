/** Carrinho da vitrine — só no browser (localStorage). */

export type StoreCartLineClient = {
  productId: string;
  variantId: string | null;
  name: string;
  imageUrl: string | null;
  priceCents: number;
  quantity: number;
  optionsLabel: string | null;
};

function key(storeId: string) {
  return `atrako-store-cart:${storeId}`;
}

export function readStoreCart(storeId: string): StoreCartLineClient[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = localStorage.getItem(key(storeId));
    if (!raw) return [];
    const parsed = JSON.parse(raw) as StoreCartLineClient[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function writeStoreCart(storeId: string, lines: StoreCartLineClient[]) {
  localStorage.setItem(key(storeId), JSON.stringify(lines));
  window.dispatchEvent(new CustomEvent("atrako-store-cart", { detail: { storeId } }));
}

export function addToStoreCart(storeId: string, line: StoreCartLineClient) {
  const lines = readStoreCart(storeId);
  const idx = lines.findIndex(
    (l) => l.productId === line.productId && l.variantId === line.variantId,
  );
  if (idx >= 0) {
    lines[idx] = {
      ...lines[idx],
      quantity: Math.min(99, lines[idx].quantity + line.quantity),
      priceCents: line.priceCents,
      name: line.name,
    };
  } else {
    lines.push(line);
  }
  writeStoreCart(storeId, lines);
  return lines;
}

export function setStoreCartQty(
  storeId: string,
  productId: string,
  variantId: string | null,
  quantity: number,
) {
  let lines = readStoreCart(storeId);
  if (quantity <= 0) {
    lines = lines.filter((l) => !(l.productId === productId && l.variantId === variantId));
  } else {
    lines = lines.map((l) =>
      l.productId === productId && l.variantId === variantId
        ? { ...l, quantity: Math.min(99, quantity) }
        : l,
    );
  }
  writeStoreCart(storeId, lines);
  return lines;
}

export function clearStoreCart(storeId: string) {
  writeStoreCart(storeId, []);
}

export function cartCount(lines: StoreCartLineClient[]) {
  return lines.reduce((s, l) => s + l.quantity, 0);
}
