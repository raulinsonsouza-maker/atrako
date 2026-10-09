/**
 * Artefatos que o assistente mostra na conversa (gráficos, referências, prévias, testes).
 * Compartilhado client/server: só tipos e helpers puros.
 * O modelo nunca recebe o artefato inteiro, só `artifactSummary`.
 */

export type ChartKind = "line" | "bar" | "donut" | "funnel";
export type ChartUnit = "currency" | "number" | "percent";

export type ChartArtifact = {
  kind: "chart";
  id: string;
  chart: ChartKind;
  title: string;
  unit: ChartUnit;
  xKey: string;
  series: Array<{ key: string; label: string; tone?: "current" | "previous" | "spend" | "revenue" }>;
  data: Array<Record<string, string | number | null>>;
  note?: string;
};

export type ReferenceItem = {
  title: string;
  url: string;
  snippet?: string;
  image?: string | null;
  /** Texto guardado para a conversa. O cartão mostra só o snippet. */
  memo?: string;
};

export type ReferencesArtifact = {
  kind: "references";
  id: string;
  title: string;
  items: ReferenceItem[];
};

export type LpPreviewArtifact = {
  kind: "lp_preview";
  id: string;
  productId: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  previewUrl: string;
  publicUrl: string;
  editPath: string;
  formId: string | null;
  hasCheckout: boolean;
};

export type FormPreviewArtifact = {
  kind: "form_preview";
  id: string;
  formId: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  previewUrl: string;
  publicUrl: string;
  fields: Array<{ label: string; type: string; required: boolean }>;
};

export type TestStep = { label: string; ok: boolean; detail?: string };

export type TestResultArtifact = {
  kind: "test_result";
  id: string;
  title: string;
  ok: boolean;
  steps: TestStep[];
  submitted?: Record<string, string>;
};

export type ResourceCreatedArtifact = {
  kind: "resource_created";
  id: string;
  resource: "landing_page" | "form" | "product";
  resourceId: string;
  name: string;
  status: "DRAFT" | "PUBLISHED";
  editPath?: string;
  publicPath?: string;
};

export type ContactCartItem = { title: string; quantity: number; unitPriceCents: number | null; imageUrl: string | null };

/** Cartão do cliente (mesmo card do CRM) com o carrinho e o histórico de compra. */
export type ContactCardArtifact = {
  kind: "contact_card";
  id: string;
  contactId: string | null;
  leadId: string | null;
  name: string;
  email: string | null;
  phone: string | null;
  location: string | null;
  stage: string | null;
  source: string | null;
  dealValue: number | null;
  createdAt: string;
  activityAt: string;
  customer: { lifecycle: string; orders: number; totalSpentCents: number; lastOrderAt: string | null } | null;
  cart: {
    status: "OPEN" | "RECOVERED" | "EXPIRED";
    store: string;
    totalCents: number;
    abandonedAt: string;
    notifiedAt: string | null;
    recoveredAt: string | null;
    items: ContactCartItem[];
    recoveryUrl: string | null;
  } | null;
};

export type Artifact =
  | ChartArtifact
  | ReferencesArtifact
  | LpPreviewArtifact
  | FormPreviewArtifact
  | TestResultArtifact
  | ResourceCreatedArtifact
  | ContactCardArtifact;

export const MAX_ARTIFACTS_PER_ANSWER = 6;

let seq = 0;
export function artifactId(prefix: string): string {
  seq = (seq + 1) % 1_000_000;
  return `${prefix}_${Date.now().toString(36)}${seq.toString(36)}`;
}

/** O que o modelo fica sabendo do artefato (curto, sem os dados). */
export function artifactSummary(a: Artifact): string {
  switch (a.kind) {
    case "chart":
      return `Gráfico "${a.title}" exibido na conversa.`;
    case "references":
      return `${a.items.length} referência(s) da web exibidas na conversa.`;
    case "lp_preview":
      return a.status === "PUBLISHED"
        ? `Landing page "${a.name}" (id ${a.productId}) publicada; o cartão na conversa mostra a página e o botão "Ver página no ar".`
        : `Prévia da landing page "${a.name}" (id ${a.productId}, rascunho) aberta na conversa, com botões de testar e publicar.`;
    case "form_preview":
      return `Prévia do formulário "${a.name}" (id ${a.formId}) aberta na conversa.`;
    case "test_result":
      return `Resultado do teste "${a.title}" exibido na conversa (${a.ok ? "tudo certo" : "com problemas"}).`;
    case "resource_created":
      return `${a.resource === "form" ? "Formulário" : a.resource === "product" ? "Produto" : "Landing page"} "${a.name}" (id ${a.resourceId}) gravado como ${a.status === "PUBLISHED" ? "publicado" : "rascunho"}.`;
    case "contact_card":
      return `Cartão do cliente "${a.name}" exibido na conversa (contato, etapa${a.cart ? ", itens do carrinho" : ""}${a.customer ? ", compras" : ""} e botão para abrir no CRM) — não repita esses dados.`;
  }
}

export type RememberedPage = { url: string; title: string; memo: string };

/** Mesma página com ou sem barra no final, sem query de cupom. */
export function pageKey(url: string): string {
  try {
    const parsed = new URL(url.trim());
    const path = parsed.pathname.replace(/\/+$/, "") || "/";
    return `${parsed.host}${path}`.toLowerCase();
  } catch {
    return url.trim().toLowerCase();
  }
}

/** Páginas que esta conversa já leu de verdade (não só o banner do cartão). */
export function rememberedPages(artifacts: Artifact[] | undefined): RememberedPage[] {
  const out: RememberedPage[] = [];
  const seen = new Set<string>();
  for (const artifact of artifacts ?? []) {
    if (artifact.kind !== "references" || artifact.title !== "Página lida") continue;
    for (const item of artifact.items) {
      const memo = item.memo?.trim() ?? "";
      const key = pageKey(item.url);
      if (memo.length < 80 || seen.has(key)) continue;
      seen.add(key);
      out.push({ url: item.url, title: item.title, memo: memo.slice(0, 1600) });
    }
  }
  return out;
}

export function pagesNote(pages: RememberedPage[]): string {
  if (!pages.length) return "";
  const body = pages.map((page) => `URL: ${page.url}\nTítulo: ${page.title}\n${page.memo}`).join("\n\n");
  return `[Páginas já lidas nesta conversa. Não chame ler_pagina de novo para estes endereços. Use este texto.]\n${body}`;
}

/** Nota curta anexada ao histórico para o modelo lembrar o que criou em turnos anteriores. */
export function historyNote(artifacts: Artifact[] | undefined): string {
  const lines = (artifacts ?? [])
    .map((a) => {
      if (a.kind === "lp_preview") return `landing page "${a.name}" id=${a.productId} status=${a.status}`;
      if (a.kind === "form_preview") return `formulário "${a.name}" id=${a.formId} status=${a.status}`;
      if (a.kind === "resource_created" && a.resource !== "landing_page")
        return `${a.resource === "form" ? "formulário" : "produto"} "${a.name}" id=${a.resourceId} status=${a.status}`;
      if (a.kind === "contact_card" && a.contactId) return `cliente "${a.name}" contactId=${a.contactId}`;
      return null;
    })
    .filter(Boolean);
  return lines.length ? `\n\n[Recursos nesta resposta: ${[...new Set(lines)].join("; ")}]` : "";
}
