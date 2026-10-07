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

export type ReferenceItem = { title: string; url: string; snippet?: string; image?: string | null };

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

export type Artifact =
  | ChartArtifact
  | ReferencesArtifact
  | LpPreviewArtifact
  | FormPreviewArtifact
  | TestResultArtifact
  | ResourceCreatedArtifact;

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
  }
}

/** Nota curta anexada ao histórico para o modelo lembrar o que criou em turnos anteriores. */
export function historyNote(artifacts: Artifact[] | undefined): string {
  const lines = (artifacts ?? [])
    .map((a) => {
      if (a.kind === "lp_preview") return `landing page "${a.name}" id=${a.productId} status=${a.status}`;
      if (a.kind === "form_preview") return `formulário "${a.name}" id=${a.formId} status=${a.status}`;
      if (a.kind === "resource_created" && a.resource !== "landing_page")
        return `${a.resource === "form" ? "formulário" : "produto"} "${a.name}" id=${a.resourceId} status=${a.status}`;
      return null;
    })
    .filter(Boolean);
  return lines.length ? `\n\n[Recursos nesta resposta: ${[...new Set(lines)].join("; ")}]` : "";
}
