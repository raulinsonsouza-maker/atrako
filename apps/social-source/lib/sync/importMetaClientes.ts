import { fetchAdAccounts } from "@/lib/meta/metaClient";
import { prisma } from "@/lib/db";
import { PLATAFORMA_META, normalizeMetaAccountId, upsertContaPlataforma } from "@/lib/repositories/contasRepository";
import { getIntegrationsConfig } from "@/lib/config/integrations";

function slugFromName(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80) || "conta-meta";
}

/** Normaliza para comparação: lowercase, sem acentos, só alfanuméricos. */
function normalizeForMatch(name: string): string {
  return (name ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "")
    .trim();
}

function ensureUniqueSlug(baseSlug: string, existingSlugs: Set<string>): string {
  let slug = baseSlug;
  let suffix = 0;
  while (existingSlugs.has(slug)) {
    suffix++;
    slug = `${baseSlug}-${suffix}`;
  }
  return slug;
}

export interface ImportMetaResult {
  accountId: string;
  nome: string;
  action: "created" | "linked" | "skipped";
  clienteId?: string;
  slug?: string;
  error?: string;
}

/**
 * Importa clientes e contas Meta a partir da API.
 * - Se accountId já existe em Conta → skipped
 * - Se nome da conta Meta coincide com cliente existente (por nome/slug) → linked (adiciona Conta ao cliente)
 * - Caso contrário → created (novo Cliente + Conta)
 * Nunca cria duplicados.
 */
export async function importMetaClientes(): Promise<ImportMetaResult[]> {
  const fromDb = await getIntegrationsConfig();
  const token = fromDb.metaAccessToken ?? process.env.META_ACCESS_TOKEN;
  if (!token) {
    return [{ accountId: "_", nome: "_", action: "skipped", error: "META_ACCESS_TOKEN não configurado" }];
  }

  const accounts = await fetchAdAccounts(token);
  const results: ImportMetaResult[] = [];

  const existingContas = await prisma.conta.findMany({
    where: { plataforma: PLATAFORMA_META },
    select: { accountIdPlataforma: true },
  });
  const existingAccountIds = new Set(
    existingContas
      .map((c) => normalizeMetaAccountId(c.accountIdPlataforma))
      .filter(Boolean) as string[]
  );

  const existingClientes = await prisma.cliente.findMany({
    select: { id: true, nome: true, slug: true },
  });
  const existingSlugs = new Set(existingClientes.map((c) => c.slug));

  /** Encontra cliente existente por nome ou slug normalizado. */
  function findMatchingCliente(metaNome: string): (typeof existingClientes)[0] | null {
    const metaSlug = slugFromName(metaNome);
    const metaNorm = normalizeForMatch(metaNome);

    for (const c of existingClientes) {
      if (c.slug === metaSlug) return c;
      if (normalizeForMatch(c.nome) === metaNorm) return c;
      if (slugFromName(c.nome) === metaSlug) return c;
    }
    return null;
  }

  for (const acc of accounts) {
    const accountId = normalizeMetaAccountId(acc.id) ?? acc.id;
    const nome = acc.name?.trim() || `Conta ${accountId}`;

    if (existingAccountIds.has(accountId)) {
      results.push({ accountId, nome, action: "skipped" });
      continue;
    }

    try {
      const matchingCliente = findMatchingCliente(nome);

      if (matchingCliente) {
        await upsertContaPlataforma({
          clienteId: matchingCliente.id,
          plataforma: PLATAFORMA_META,
          accountIdPlataforma: accountId,
          nomeConta: nome,
        });
        existingAccountIds.add(accountId);

        results.push({
          accountId,
          nome,
          action: "linked",
          clienteId: matchingCliente.id,
          slug: matchingCliente.slug,
        });
        continue;
      }

      const baseSlug = slugFromName(nome);
      const slug = ensureUniqueSlug(baseSlug, existingSlugs);

      const cliente = await prisma.cliente.create({
        data: {
          nome,
          slug,
          ativo: true,
        },
      });

      await upsertContaPlataforma({
        clienteId: cliente.id,
        plataforma: PLATAFORMA_META,
        accountIdPlataforma: accountId,
        nomeConta: nome,
      });

      existingAccountIds.add(accountId);
      existingSlugs.add(slug);

      results.push({
        accountId,
        nome,
        action: "created",
        clienteId: cliente.id,
        slug: cliente.slug,
      });
    } catch (e) {
      const message = e instanceof Error ? e.message : String(e);
      results.push({ accountId, nome, action: "skipped", error: message });
    }
  }

  return results;
}
