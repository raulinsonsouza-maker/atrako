/**
 * Dados do comprador que o Mercado Livre manda no pedido, na cobrança e no envio.
 * Sem rede e sem banco: só leitura do JSON.
 */

export type MlBuyerFacts = {
  name: string | null;
  nickname: string | null;
  email: string | null;
  phone: string | null;
  city: string | null;
  state: string | null;
  street: string | null;
  neighborhood: string | null;
  zip: string | null;
  docType: string | null;
  docNumber: string | null;
};

const PAYMENT_LABELS: Record<string, string> = {
  pix: "Pix",
  account_money: "saldo Mercado Pago",
  credit_card: "cartão",
  debit_card: "cartão de débito",
  ticket: "boleto",
  bank_transfer: "Pix",
};

const SHIPPING_STATUS_LABELS: Record<string, string> = {
  delivered: "entregue",
  shipped: "a caminho",
  ready_to_ship: "pronto para envio",
  pending: "envio pendente",
  handling: "em preparação",
  cancelled: "envio cancelado",
  not_delivered: "não entregue",
};

function text(raw: unknown): string | null {
  if (typeof raw === "number" && Number.isFinite(raw)) return String(raw);
  const s = typeof raw === "string" ? raw.trim() : "";
  return s || null;
}

function record(raw: unknown): Record<string, unknown> | null {
  return raw && typeof raw === "object" && !Array.isArray(raw) ? (raw as Record<string, unknown>) : null;
}

function infoValue(list: unknown, type: string): string | null {
  if (!Array.isArray(list)) return null;
  const row = list.find((item) => {
    const rec = record(item);
    return rec?.type === type || rec?.id === type;
  });
  return text(record(row)?.value);
}

function named(raw: unknown): string | null {
  if (typeof raw === "string") return text(raw);
  return text(record(raw)?.name);
}

function joinName(first: string | null, last: string | null): string | null {
  const name = [first, last].filter(Boolean).join(" ").trim();
  return name || null;
}

/** "BR-SP" → "SP". Nome por extenso fica de fora para não virar "São Paulo/São Paulo". */
export function mlStateUf(state: string | null | undefined): string | null {
  const raw = (state ?? "").trim();
  if (!raw) return null;
  const prefixed = raw.toUpperCase().match(/BR-([A-Z]{2})\b/);
  if (prefixed) return prefixed[1];
  if (/^[A-Za-z]{2}$/.test(raw)) return raw.toUpperCase();
  return null;
}

export function mlShippingLabel(
  mode: string | null | undefined,
  logisticType: string | null | undefined,
): string | null {
  const logistic = (logisticType || "").toLowerCase();
  const m = (mode || "").toLowerCase();
  if (!logistic && !m) return null;
  if (logistic.includes("fulfillment") || logistic === "fbm") return "Full";
  if (logistic.includes("flex") || m.includes("flex")) return "Flex";
  if (logistic.includes("self_service") || logistic.includes("turbo")) return "Turbo / Próprio";
  if (m === "me2" || m === "me1") return "Mercado Envios";
  if (m === "custom") return "Personalizado";
  return null;
}

export function mlShippingStatusLabel(status: string | null | undefined): string | null {
  if (!status) return null;
  return SHIPPING_STATUS_LABELS[status.toLowerCase()] ?? null;
}

export function formatMlDocument(type: string | null, number: string | null): string | null {
  const digits = (number ?? "").replace(/\D/g, "");
  if (digits.length === 11) {
    return `CPF ${digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4")}`;
  }
  if (digits.length === 14) {
    return `CNPJ ${digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5")}`;
  }
  if (!digits) return null;
  const kind = (type ?? "").toUpperCase();
  return `${kind === "CPF" || kind === "CNPJ" ? kind : "Documento"} ${digits}`;
}

export function formatMlZip(zip: string | null): string | null {
  const digits = (zip ?? "").replace(/\D/g, "");
  if (digits.length !== 8) return text(zip);
  return `${digits.slice(0, 5)}-${digits.slice(5)}`;
}

export function formatMlAddress(facts: Pick<MlBuyerFacts, "street" | "neighborhood" | "zip">): string | null {
  const parts = [facts.street, facts.neighborhood, formatMlZip(facts.zip)].filter(Boolean);
  return parts.join(" · ") || null;
}

function paymentLabel(payment: Record<string, unknown> | null): { method: string | null; installments: number | null } {
  if (!payment) return { method: null, installments: null };
  const id = (text(payment.payment_method_id) ?? "").toLowerCase();
  const type = (text(payment.payment_type) ?? "").toLowerCase();
  const installments = Number(payment.installments);
  let method: string | null = null;
  if (id === "pix" || id.includes("pix")) method = "Pix";
  else if (id.startsWith("bol") || type === "ticket") method = "boleto";
  else method = PAYMENT_LABELS[id] ?? PAYMENT_LABELS[type] ?? null;
  return {
    method,
    installments: Number.isFinite(installments) && installments > 1 ? installments : null,
  };
}

function fromOrder(order: Record<string, unknown> | null): Partial<MlBuyerFacts> {
  const buyer = record(order?.buyer);
  const ship = record(record(order?.shipping)?.receiver_address);
  const phoneBits = [text(record(buyer?.phone)?.area_code), text(record(buyer?.phone)?.number)].filter(Boolean);
  return {
    name: joinName(text(buyer?.first_name), text(buyer?.last_name)) ?? text(ship?.receiver_name),
    nickname: text(buyer?.nickname),
    email: text(buyer?.email),
    phone: text(ship?.receiver_phone) ?? text(ship?.phone) ?? (phoneBits.join("") || null),
  };
}

function fromBilling(raw: unknown): Partial<MlBuyerFacts> {
  const root = record(raw);
  if (!root) return {};
  const billing = record(record(root.buyer)?.billing_info) ?? record(root.billing_info) ?? root;
  const additional = billing.additional_info;
  const address = record(billing.address);
  const identification = record(billing.identification);
  const first = text(billing.name) ?? infoValue(additional, "FIRST_NAME") ?? infoValue(additional, "BUSINESS_NAME");
  const last = text(billing.last_name) ?? infoValue(additional, "LAST_NAME");
  const streetName = text(address?.street_name) ?? infoValue(additional, "STREET_NAME");
  const streetNumber = text(address?.street_number) ?? infoValue(additional, "STREET_NUMBER");
  const street = [streetName, streetNumber].filter(Boolean).join(", ") || null;
  return {
    name: joinName(first, last),
    city: text(address?.city_name) ?? named(address?.city) ?? infoValue(additional, "CITY_NAME"),
    state:
      text(record(address?.state)?.id) ??
      named(address?.state) ??
      infoValue(additional, "STATE_NAME") ??
      infoValue(additional, "STATE_CODE"),
    street,
    neighborhood: named(address?.neighborhood) ?? infoValue(additional, "NEIGHBORHOOD"),
    zip: text(address?.zip_code) ?? infoValue(additional, "ZIP_CODE"),
    phone: infoValue(additional, "PHONE") ?? infoValue(additional, "PHONE_NUMBER"),
    docType: text(identification?.type) ?? text(billing.doc_type) ?? infoValue(additional, "DOC_TYPE"),
    docNumber: text(identification?.number) ?? text(billing.doc_number) ?? infoValue(additional, "DOC_NUMBER"),
  };
}

function fromShipment(raw: unknown): Partial<MlBuyerFacts> {
  const shipment = record(raw);
  const address = record(shipment?.receiver_address);
  if (!address) return {};
  const street = [text(address.street_name), text(address.street_number)].filter(Boolean).join(", ") || text(address.address_line);
  return {
    name: text(address.receiver_name),
    phone: text(address.receiver_phone) ?? text(address.phone),
    city: named(address.city),
    state: text(record(address.state)?.id) ?? named(address.state),
    street,
    neighborhood: named(address.neighborhood),
    zip: text(address.zip_code),
  };
}

function prefer(current: string | null | undefined, next: string | null | undefined): string | null {
  return current?.trim() || next?.trim() || null;
}

export function parseMlBuyerFacts(input: {
  order?: unknown;
  billing?: unknown;
  shipment?: unknown;
}): MlBuyerFacts {
  const order = fromOrder(record(input.order));
  const billing = fromBilling(input.billing);
  const shipment = fromShipment(input.shipment);
  return {
    name: prefer(billing.name, prefer(order.name, shipment.name)),
    nickname: order.nickname ?? null,
    email: order.email ?? null,
    phone: prefer(order.phone, prefer(shipment.phone, billing.phone)),
    city: prefer(billing.city, shipment.city),
    state: prefer(billing.state, shipment.state),
    street: prefer(billing.street, shipment.street),
    neighborhood: prefer(billing.neighborhood, shipment.neighborhood),
    zip: prefer(billing.zip, shipment.zip),
    docType: billing.docType ?? null,
    docNumber: billing.docNumber ?? null,
  };
}

export function describeMlBuyer(input: {
  facts: MlBuyerFacts;
  cityName?: string | null;
  cityRaw?: string | null;
  stateUf?: string | null;
  shippingMode?: string | null;
  logisticType?: string | null;
  shippingStatus?: string | null;
  shipment?: unknown;
}) {
  const city = input.cityName?.trim() || input.cityRaw?.trim() || input.facts.city;
  const uf = input.stateUf?.trim() || mlStateUf(input.facts.state);
  const status =
    input.shippingStatus ??
    (input.shipment && typeof input.shipment === "object"
      ? text((input.shipment as { status?: unknown }).status)
      : null);
  const shipping = [mlShippingLabel(input.shippingMode, input.logisticType), mlShippingStatusLabel(status)]
    .filter(Boolean)
    .join(" · ");
  return {
    nickname: input.facts.nickname,
    location: city ? (uf ? `${city}/${uf}` : city) : null,
    address: formatMlAddress(input.facts),
    document: formatMlDocument(input.facts.docType, input.facts.docNumber),
    shipping: shipping || null,
  };
}

export function mlPaymentFromOrder(order: unknown): { method: string | null; installments: number | null } {
  const payments = record(order)?.payments;
  if (!Array.isArray(payments)) return { method: null, installments: null };
  const rows = payments.map(record).filter((row): row is Record<string, unknown> => Boolean(row));
  const approved = rows.find((row) => text(row.status)?.toLowerCase() === "approved") ?? rows[0] ?? null;
  return paymentLabel(approved);
}
