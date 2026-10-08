import "server-only";
import { prisma } from "@/lib/db";
import { anonymizeSection, fxUsed, skeletonHash, splitSections, worthKeeping } from "./extract";
import { libraryPromptBlock, rankSections, type LibraryCandidate } from "./rank";
import { sectionScore } from "./score";

export async function ingestPublishedPage(input: {
  clienteId: string;
  productId: string;
  html: string;
  cssSource: string;
  goal: string;
  segmento: string | null;
  brandName: string | null;
  accent: string | null;
  issueCount: number;
}): Promise<number> {
  const sections = splitSections(input.html, input.cssSource).filter(worthKeeping);
  let saved = 0;
  for (const section of sections) {
    const clean = anonymizeSection(section, { brandName: input.brandName, accent: input.accent });
    const skeleton = skeletonHash(clean.html, clean.css);
    const existing = await prisma.lpLibrarySection.findUnique({ where: { skeleton }, select: { id: true } });
    if (existing) continue;
    const tags = [input.goal, input.segmento].filter((v): v is string => Boolean(v));
    await prisma.lpLibrarySection.create({
      data: {
        kind: section.kind,
        goal: input.goal,
        html: clean.html.slice(0, 20_000),
        css: clean.css.slice(0, 20_000),
        fx: fxUsed(section.html),
        tags,
        status: "candidate",
        score: sectionScore({
          published: true,
          issueCount: input.issueCount,
          edits: 0,
          conversionRate: null,
          uses: 0,
          approved: false,
        }),
        skeleton,
        sourceClienteId: input.clienteId,
        sourceProductId: input.productId,
      },
    });
    saved += 1;
  }
  return saved;
}

export async function libraryReferences(query: {
  clienteId: string;
  goal: "leads" | "sales";
  segmento?: string | null;
  estilo?: string | null;
}): Promise<string> {
  const rows = await prisma.lpLibrarySection.findMany({
    where: {
      OR: [{ status: "approved" }, { status: "candidate", sourceClienteId: query.clienteId }],
    },
    orderBy: { score: "desc" },
    take: 40,
  });
  const candidates: LibraryCandidate[] = rows.map((row) => ({
    id: row.id,
    kind: row.kind,
    goal: row.goal,
    html: row.html,
    css: row.css,
    tags: row.tags,
    score: row.score,
    status: row.status,
    sourceClienteId: row.sourceClienteId,
  }));
  return libraryPromptBlock(rankSections(candidates, query));
}

/** Registra data-lib e sobe a nota. Seção de outro workspace só conta se estiver aprovada. */
export async function recordLibraryUses(clienteId: string, productId: string, html: string): Promise<void> {
  const ids = [...new Set([...html.matchAll(/\sdata-lib=(["'])([^"']+)\1/gi)].map((m) => m[2]))];
  for (const sectionId of ids) {
    const section = await prisma.lpLibrarySection.findUnique({ where: { id: sectionId } });
    if (!section) continue;
    if (section.status !== "approved" && section.sourceClienteId !== clienteId) continue;
    await prisma.lpLibraryUse.create({ data: { sectionId, clienteId, productId } });
    const uses = section.uses + 1;
    await prisma.lpLibrarySection.update({
      where: { id: sectionId },
      data: {
        uses,
        score: sectionScore({
          published: true,
          issueCount: 0,
          edits: 0,
          conversionRate: null,
          uses,
          approved: section.status === "approved",
        }),
      },
    });
  }
}
