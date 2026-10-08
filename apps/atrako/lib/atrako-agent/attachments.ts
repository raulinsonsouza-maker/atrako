/**
 * Anexos do agente: tipo, dono da URL e o bloco de texto que o modelo lê.
 * Sem rede e sem arquivo — dá para testar.
 */

export type AttachmentKind = "image" | "document" | "video";

export type ChatAttachment = {
  id: string;
  name: string;
  kind: AttachmentKind;
  mime: string;
  url: string;
  /** Texto do documento ou descrição da imagem. */
  text?: string;
};

export const ATTACHMENT_LIMITS = {
  maxFiles: 4,
  image: 5 * 1024 * 1024,
  document: 8 * 1024 * 1024,
  video: 25 * 1024 * 1024,
  text: 8_000,
} as const;

const IMAGE = new Set(["image/png", "image/jpeg", "image/jpg", "image/webp", "image/gif"]);
const VIDEO = new Set(["video/mp4", "video/webm"]);
const DOC_EXT = new Set(["pdf", "txt", "md", "csv", "docx"]);

function extOf(name: string) {
  return name.split(".").pop()?.toLowerCase() ?? "";
}

export function kindFromFile(mime: string, name: string): AttachmentKind | null {
  const type = mime.toLowerCase();
  const ext = extOf(name);
  if (IMAGE.has(type) || ["png", "jpg", "jpeg", "webp", "gif"].includes(ext)) return "image";
  if (VIDEO.has(type) || ext === "mp4" || ext === "webm") return "video";
  if (DOC_EXT.has(ext) || type === "application/pdf" || type.startsWith("text/")) return "document";
  return null;
}

export function attachmentTooBig(kind: AttachmentKind, size: number) {
  return size > ATTACHMENT_LIMITS[kind];
}

/** A URL tem de ser um upload deste workspace (disco ou Blob). */
export function attachmentOwnedBy(url: string, workspaceId: string): boolean {
  const id = workspaceId.trim();
  if (!id || !url) return false;
  if (url.startsWith("/lp-media/")) return url.slice("/lp-media/".length).startsWith(`${id}_`);
  try {
    const parsed = new URL(url);
    return parsed.protocol === "https:" && parsed.pathname.includes(`/lp/${id}/`);
  } catch {
    return false;
  }
}

export function plainTextExcerpt(bytes: Buffer): string {
  return bytes.toString("utf8").replace(/\u0000/g, "").trim().slice(0, ATTACHMENT_LIMITS.text);
}

export function attachmentDigest(items: ChatAttachment[]): string {
  if (!items.length) return "";
  const lines = items.map((item) => {
    if (item.kind === "image") {
      const note = item.text?.trim()
        ? `descrição: ${item.text.trim()}`
        : "não deu para descrever; a página pode usar a foto";
      return `- imagem (${item.name}): ${item.url}\n  ${note}`;
    }
    if (item.kind === "video") {
      return `- vídeo (${item.name}): ${item.url}\n  não foi assistido; pode incorporar na página se a pessoa pedir`;
    }
    const body = item.text?.trim() ? item.text.trim() : "(sem texto extraído)";
    return `- documento (${item.name}):\n  ${body}`;
  });
  return [
    "[Anexos]",
    "Fato da conversa. Foto sem descrição: avise que não deu para descrever; a página ainda pode usar a foto. Vídeo não foi assistido.",
    ...lines,
  ].join("\n");
}

function sectionAfter(digest: string, label: "imagem" | "vídeo"): Array<{ url: string; name: string }> {
  const out: Array<{ url: string; name: string }> = [];
  const re = new RegExp(`^- ${label} \\(([^)]*)\\): (https?:\\/\\/\\S+|\\/lp-media\\/\\S+)`, "gim");
  for (const match of digest.matchAll(re)) {
    const url = match[2].trim();
    if (!out.some((item) => item.url === url)) out.push({ name: match[1].trim() || "arquivo", url });
  }
  return out;
}

export function imagesFromDigest(text: string) {
  return sectionAfter(text, "imagem");
}

/** A foto da pessoa ocupa o hero. O banco de imagens entra depois, como seção. */
export function imagesForBrief(
  user: Array<{ url: string; name: string }>,
  stock: Array<{ rotulo: string; url: string; alt: string; papel: string }>,
) {
  const mine = user.slice(0, 6).map((img, i) => ({
    rotulo: `IMG${i + 1}`,
    url: img.url,
    alt: img.name,
    papel: i === 0 ? "hero" : "seção",
  }));
  const rest = stock.map((line, i) => ({
    ...line,
    rotulo: `IMG${mine.length + i + 1}`,
    papel: mine.length ? "seção" : line.papel,
  }));
  return [...mine, ...rest].slice(0, 8);
}

export function namesFromDigest(text: string): string[] {
  const names = [...text.matchAll(/^- (?:imagem|vídeo|documento) \(([^)]*)\)/gim)].map((m) => m[1].trim()).filter(Boolean);
  return [...new Set(names)].slice(0, ATTACHMENT_LIMITS.maxFiles);
}

export function videosFromDigest(text: string) {
  return sectionAfter(text, "vídeo");
}

/** Aceita só o que este workspace enviou. Texto do cliente é cortado. */
export function sanitizeAttachments(raw: unknown, workspaceId: string): ChatAttachment[] {
  if (!Array.isArray(raw)) return [];
  const out: ChatAttachment[] = [];
  for (const item of raw) {
    if (!item || typeof item !== "object") continue;
    const row = item as Record<string, unknown>;
    const url = typeof row.url === "string" ? row.url.trim() : "";
    const name = (typeof row.name === "string" ? row.name : "arquivo").trim().slice(0, 120) || "arquivo";
    const mime = typeof row.mime === "string" ? row.mime.slice(0, 160) : "";
    const kind = row.kind === "image" || row.kind === "document" || row.kind === "video" ? row.kind : kindFromFile(mime, name);
    if (!kind || !attachmentOwnedBy(url, workspaceId)) continue;
    const text = typeof row.text === "string" ? row.text.replace(/\u0000/g, "").trim().slice(0, ATTACHMENT_LIMITS.text) : "";
    out.push({
      id: (typeof row.id === "string" ? row.id : url).slice(0, 80),
      name,
      kind,
      mime,
      url,
      ...(text ? { text } : {}),
    });
    if (out.length >= ATTACHMENT_LIMITS.maxFiles) break;
  }
  return out;
}
