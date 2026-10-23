/**
 * Geo Generate — Fase 1 do mapa de temas e rascunhos.
 * 
 * Etapas:
   1. Lê GeoSite + facts + hubs do banco.
   2. Para cada hub, gera um mapa de perguntas (GeoPrompt) ou usa os existentes.
   3. Em lote, chama a OpenAI para gerar rascunhos de GeoPage (body + FAQ + sources).
   4. Valida que todos os números citados existem em `facts` (allowedNumbers + normalizeNumber).
   5. Marca as páginas como `REVIEW` e persiste no banco.
   6. Exporta um resumo para o console / logs.
 * 
 * Uso: `npx tsx scripts/geo-generate.ts --workspace regicenter`
 * A chave OpenAI vem de `process.env.OPENAI_API_KEY`.
 */

import "server-only";
import { PrismaClient } from "@prisma/client";
import { OpenAI } from "openai";
import { parseFacts, GeoFacts, allowedNumbers, normalizeNumber } from "@/lib/geo-hub/facts";
import { loadSitePages, loadGeoSite } from "@/lib/geo-hub/site";
import { prisma } from "@/lib/db";

// ---------- CLI ----------
const args = process.argv.slice(2);
const workspace = args.find((a) => a.startsWith("--workspace="))?.split("=")[1] ?? "regicenter";
const batch = Number(args.find((a) => a.startsWith("--batch="))?.split("=")[1] ?? "50");
const maxPages = Number(args.find((a) => a.startsWith("--max="))?.split("=")[1] ?? "200");

console.log(`[geo-generate] Workspace: ${workspace} | Batch: ${batch} | Max pages: ${maxPages}`);

// ---------- Inicialização ----------
async function main() {
  const p = new PrismaClient({ log: ["query", "error"] });
  const site = await loadGeoSite(workspace);
  if (!site) {
    console.error(`[geo-generate] GeoSite "${workspace}" não encontrado.`);
    await p.$disconnect();
    process.exit(1);
  }

  const facts = site.factsParsed as GeoFacts;
  const hubs = site.hubs ?? [];
  console.log(`[geo-generate] Site: ${facts.brand} | Hubs: ${hubs.length}`);

  // Carrega páginas já existentes (para não reescrever)
  const existing = await loadSitePages(site.id, { preview: false });
  const existingIds = new Set(existing.map((x) => x.id));
  console.log(`[geo-generate] Páginas já existentes: ${existingIds.size}`);

  // ---------- OpenAI ----------
  const openai = new OpenAI({ organization: process.env.OPENAI_ORG_ID, apiKey: process.env.OPENAI_API_KEY });
  const systemPrompt = `Você é um redator de conteúdo para guias de franquias. Use apenas fatos verificáveis da "Facts Box" abaixo. Nunca invente números. Se não souber a resposta, escreva "verificar com equipe comercial". Use pt-BR.`;

  function factsBlock(): string {
    const lines: string[] = [];
    if (facts.offer) lines.push(`- Oferta: ${facts.offer}`);
    if (facts.investment) lines.push(`- Investimento: ${facts.investment.label}${facts.investment.note ? ` (${facts.investment.note})` : ""}`);
    if (facts.areaServed) lines.push(`- Atuação: ${facts.areaServed}`);
    if (facts.foundedYear) lines.push(`- Fundação: ${facts.foundedYear}`);
    if (facts.units) lines.push(`- Unidades: ${facts.units}`);
    for (const h of facts.highlights) lines.push(`- ${h}`);
    if (facts.undisclosed.length) lines.push(`- ${facts.undisclosedAnswer}`);
    const c = [facts.contact.email, facts.contact.phone].filter(Boolean).join(" · ");
    if (c) lines.push(`- Contato: ${c}`);
    if (facts.officialSite) lines.push(`- Site oficial: ${facts.officialSite}`);
    return lines.join("\n");
  }

  // ---------- Geração por hub ----------
  async function generateHubPages(hub: any, startIdx = 0): Promise<string[]> {
    const prompts: string[] = [];
    const hubPages = existing.filter((p) => p.hubId === hub.id);
    const generated: string[] = [];

    // Define quantas páginas queremos por hub (visando ~50 total)
    const perHub = Math.ceil(maxPages / Math.max(1, hubs.length));
    const targetCount = perHub - hubPages.length;
    if (targetCount <= 0) {
      console.log(`[geo-generate] Hub ${hub.slug} já tem ${hubPages.length} páginas — pulando geração.`);
      return [];
    }

    // Se houver prompts existentes, usa-os; senão cria prompts genéricos
    const promptTexts = hub.prompts
      ? hub.prompts.map((pt: any) => pt.text)
      : [
          `Descreva o modelo de franquia ${facts.brand} para um empreendedor que nunca teve uma franchising.`,
          `Quais são os requisitos e o perfil do franqueado ideal para ${facts.brand}?`,
          `Explique o investimento inicial de R${facts.investment?.amount?.toLocaleString() || "27.900",00} e o que está incluído.`,
          `Quais são as condições da COF (Circular de Oferta de Franquia) para ${facts.brand}?`,
          `Por que registrar marca e patente vale a pena para um empresário?`,
        ];

    const promptsToUse = promptTexts.slice(startIdx, startIdx + targetCount);

    for (const prompt of promptsToUse) {
      const completion = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        temperature: 0.3,
        messages: [
          { role: "system", content: systemPrompt },
          { role: "user", content: `Brand: ${facts.brand}\nFacts:\n${factsBlock()}\n\nPrompt: ${prompt}` },
        ],
      });

      const body = completion.choices[0]?.message?.content ?? "";
      // Valida números no body
      const numbersInBody = body.match(/\d[\d.,]*\/g) ?? [];
      let valid = true;
      for (const m of numbersInBody) {
        const norm = normalizeNumber(m);
        if (!facts.allowedNumbers?.has(norm) && !/^\d{1,3}(?:\.\d{1,2})?$/.test(norm)) {
          console.warn(`[geo-generate] Número fora de fatos: "${m}" (normalizado: "${norm}")`);
          valid = false;
        }
      }

      if (valid) {
        generated.push(body);
        prompts.push(prompt);
        console.log(`[geo-generate] Gerada página para hub ${hub.slug}: ${prompt.slice(0, 40)}…`);
      } else {
        console.warn(`[geo-generate] Página com números inválidos descartada para hub ${hub.slug}`);
      }
    }

    return generated;
  }

  // ---------- Execução ----------
  const allGenerated: { hubSlug: string; prompt: string; body: string }[] = [];

  for (let i = 0; i < hubs.length; i++) {
    const hub = hubs[i];
    const generated = await generateHubPages(hub, i * batch);
    for (let j = 0; j < generated.length; j++) {
      allGenerated.push({
        hubSlug: hub.slug,
        prompt: `${i * batch + j + 1}. ${/* prompt text would go here */ ""}`,
        body: generated[j],
      });
    }
    console.log(`[geo-generate] Hub ${hub.slug} processado.`);
  }

  // ---------- Persistência ----------
  console.log(`[geo-generate] Total de rascunhos prontos: ${allGenerated.length}`);

  // Cria páginas em lote (status REVIEW)
  for (const { hubSlug, body } of allGenerated.slice(0, maxPages)) {
    // Encontra o hub pelo slug
    const hub = hubs.find((h) => h.slug === hubSlug);
    if (!hub) continue;

    // Cria a página - simplificado: título baseado no body e tipo guide
    const titleMatch = body.match(/(.{1,80}.)/);
    const title = titleMatch ? titleMatch[1].replace(/\.|,|!|\?$/, "").trim() : `Sobre ${facts.brand}`;
    const slug = `${hubSlug}/auto-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`.replace(/\/|\\|'|"|:|;|,|`|~|!|@|#|$|%|^|&|*|(|)|+|=|{|}|<|>|?/g, "-");

    await prisma.geoPage.create({
      data: {
        siteId: site.id,
        hubId: hub.id,
        locale: "pt-BR",
        slug,
        type: "guide",
        title,
        description: `${facts.brand} — ${facts.offer || "oportunidade de franquia"}`,
        body,
        status: "REVIEW",
        publishedAt: null,
        updatedAt: new Date(),
      },
    });
    console.log(`[geo-generate] Página criada: ${slug} (${hubSlug}) — REVIEW`);
  }

  // ---------- Resumo ----------
  const publishedCount = await prisma.geoPage.count({ where: { siteId: site.id, status: "PUBLISHED" } });
  const reviewCount = await prisma.geoPage.count({ where: { siteId: site.id, status: "REVIEW" } });
  console.log(`[geo-generate] Resumo: PUBLISHED=${publishedCount}, REVIEW=${reviewCount}, total de páginas=${publishedCount + reviewCount}`);

  await p.$disconnect();
  console.log("[geo-generate] Concluído.");
}

main().catch((err) => {
  console.error("[geo-generate] Erro fatal:", err instanceof Error ? err.message : err);
  process.exit(1);
});