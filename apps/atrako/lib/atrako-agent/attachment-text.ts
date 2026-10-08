import "server-only";
import { kindFromFile, plainTextExcerpt } from "./attachments";

/** Texto de txt, md, csv, pdf ou docx. Falha vira string vazia — a página segue sem o trecho. */
export async function excerptFromFile(bytes: Buffer, mime: string, name: string): Promise<string> {
  const kind = kindFromFile(mime, name);
  if (kind !== "document") return "";
  const ext = name.split(".").pop()?.toLowerCase() ?? "";
  try {
    if (ext === "pdf" || mime === "application/pdf") {
      const { extractText, getDocumentProxy } = await import("unpdf");
      const pdf = await getDocumentProxy(new Uint8Array(bytes));
      const { text } = await extractText(pdf, { mergePages: true });
      const joined = Array.isArray(text) ? text.join("\n") : String(text ?? "");
      return joined.replace(/\u0000/g, "").trim().slice(0, 8000);
    }
    if (ext === "docx" || mime.includes("wordprocessingml")) {
      const mod = await import("mammoth");
      const mammoth = "extractRawText" in mod ? mod : mod.default;
      const result = await mammoth.extractRawText({ buffer: bytes });
      return String(result.value ?? "").replace(/\u0000/g, "").trim().slice(0, 8000);
    }
    return plainTextExcerpt(bytes);
  } catch (error) {
    console.warn("[atrako-attachment] texto", error instanceof Error ? error.message.slice(0, 160) : "");
    return "";
  }
}
