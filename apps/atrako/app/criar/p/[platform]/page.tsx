"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { Loader2 } from "lucide-react";
import { AppPage } from "@/components/layout/AppPage";
import { BackLink } from "@/components/ui/back-link";
import { SearchInput } from "@/components/ui/search-input";
import {
  getPlatform,
  isCriarPlatformId,
  platformHref,
  recipesForPlatform,
  type CriarRecipe,
} from "@/lib/criar/catalog";
import type { CriarMode } from "@/lib/criar/modules";

function recipeRank(r: CriarRecipe) {
  if (r.recommended) return 0;
  if (r.badges.includes("popular")) return 1;
  if (r.href && r.badges.includes("quick")) return 2;
  if (r.href) return 3;
  return 4;
}

function sortByUse(recipes: CriarRecipe[]) {
  return [...recipes].sort((a, b) => {
    const d = recipeRank(a) - recipeRank(b);
    if (d !== 0) return d;
    return a.title.localeCompare(b.title, "pt-BR");
  });
}

function RecipeCard({ recipe }: { recipe: CriarRecipe }) {
  const soon = !recipe.href;
  const inner = (
    <>
      <div className="flex items-start justify-between gap-3">
        <h3 className="type-caption-strong text-[var(--ink)]">{recipe.title}</h3>
        {soon ? (
          <span className="criar-recipe-badge shrink-0" data-tone="soon">
            Em breve
          </span>
        ) : null}
      </div>
      <p className="mt-1.5 type-fine-print text-[var(--ink-muted-48)]">
        {recipe.description}
      </p>
    </>
  );

  if (soon) {
    return (
      <div className="criar-module-card criar-module-card--soon" aria-disabled>
        {inner}
      </div>
    );
  }

  return (
    <Link href={recipe.href!} className="criar-module-card">
      {inner}
    </Link>
  );
}

function RecipeGrid({ recipes }: { recipes: CriarRecipe[] }) {
  if (recipes.length === 0) {
    return (
      <p className="type-caption text-[var(--ink-muted-48)]">Nada encontrado.</p>
    );
  }
  return (
    <div className="criar-gallery-grid">
      {recipes.map((r) => (
        <RecipeCard key={r.id} recipe={r} />
      ))}
    </div>
  );
}

function Section({
  title,
  hint,
  recipes,
}: {
  title: string;
  hint?: string;
  recipes: CriarRecipe[];
}) {
  if (recipes.length === 0) return null;
  return (
    <section className="criar-recipe-section">
      <div>
        <h2 className="type-caption-strong text-[var(--ink)]">{title}</h2>
        {hint ? (
          <p className="mt-1 type-fine-print text-[var(--ink-muted-48)]">{hint}</p>
        ) : null}
      </div>
      <RecipeGrid recipes={recipes} />
    </section>
  );
}

function PlatformCatalogInner() {
  const params = useParams();
  const router = useRouter();
  const sp = useSearchParams();
  const raw = String(params.platform ?? "");
  const mode: CriarMode = sp.get("mode") === "ai" ? "ai" : "manual";
  const valid = isCriarPlatformId(raw);

  /** Loja unificada no hub Minhas páginas. */
  useEffect(() => {
    if (raw === "loja") {
      router.replace(platformHref("loja", mode));
    }
  }, [raw, mode, router]);

  const [q, setQ] = useState("");

  const all = useMemo(
    () => (valid ? recipesForPlatform(raw, mode) : []),
    [valid, raw, mode],
  );

  const filtered = useMemo(() => {
    const needle = q.trim().toLowerCase();
    if (!needle) return all;
    return all.filter(
      (r) =>
        r.title.toLowerCase().includes(needle) ||
        r.description.toLowerCase().includes(needle),
    );
  }, [all, q]);

  const searching = Boolean(q.trim());

  const sections = useMemo(() => {
    const sorted = sortByUse(filtered);

    if (searching) {
      return [{ title: "Resultados", recipes: sorted }] as const;
    }

    if (raw === "anuncios") {
      const maisUsados = sorted.filter(
        (r) => r.group === "meta" && r.href && (r.recommended || r.badges.includes("popular")),
      );
      const maisUsadosIds = new Set(maisUsados.map((r) => r.id));
      const metaRest = sorted.filter(
        (r) => r.group === "meta" && r.href && !maisUsadosIds.has(r.id),
      );
      const outras = sorted.filter((r) => r.group === "outras");
      return [
        {
          title: "Mais usados",
          hint: "Objetivos Meta que a maioria começa",
          recipes: maisUsados,
        },
        { title: "Meta", recipes: metaRest },
        {
          title: "Outras plataformas",
          hint: "Em breve",
          recipes: outras,
        },
      ] as const;
    }

    const maisUsados = sorted.filter(
      (r) => r.href && (r.recommended || r.badges.includes("popular")),
    );
    const maisUsadosIds = new Set(maisUsados.map((r) => r.id));
    const disponiveis = sorted.filter(
      (r) => r.href && !maisUsadosIds.has(r.id),
    );
    const emBreve = sorted.filter((r) => !r.href);

    return [
      {
        title: "Mais usados",
        hint: raw === "instagram" ? "Comece por estes" : undefined,
        recipes: maisUsados,
      },
      {
        title: "Mais opções",
        recipes: disponiveis,
      },
      {
        title: "Em breve",
        recipes: emBreve,
      },
    ] as const;
  }, [filtered, searching, raw]);

  if (!valid || raw === "loja") {
    return (
      <AppPage title="Criar" actions={<BackLink href="/criar" />}>
        {raw === "loja" ? (
          <div className="flex flex-1 items-center justify-center py-20">
            <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
          </div>
        ) : (
          <p className="type-caption text-[var(--ink-muted-48)]">
            Plataforma não encontrada.{" "}
            <Link href="/criar" className="text-[var(--primary)]">
              Voltar ao Criar
            </Link>
          </p>
        )}
      </AppPage>
    );
  }

  const platform = getPlatform(raw)!;
  const backHref = mode === "ai" ? "/criar?assistente=1" : "/criar";

  return (
    <AppPage title={platform.title} actions={<BackLink href={backHref} />}>
      <div className="criar-gallery-shell">
        <p className="type-caption text-[var(--ink-muted-48)]">
          {mode === "ai"
            ? "Escolha o que criar. Depois você descreve e o Atrako monta."
            : platform.desc}
        </p>

        <SearchInput
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
        />

        {sections.map((s) => (
          <Section
            key={s.title}
            title={s.title}
            hint={"hint" in s ? s.hint : undefined}
            recipes={s.recipes}
          />
        ))}
      </div>
    </AppPage>
  );
}

export default function CriarPlatformPage() {
  return (
    <Suspense
      fallback={
        <div className="flex flex-1 items-center justify-center py-20">
          <Loader2 className="h-5 w-5 animate-spin text-[var(--primary)]" />
        </div>
      }
    >
      <PlatformCatalogInner />
    </Suspense>
  );
}
