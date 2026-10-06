/** Página pública de um módulo desligado no workspace. */
export function PublicUnavailable({ brandName }: { brandName?: string | null }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--canvas-parchment)] px-4">
      <div className="max-w-sm space-y-2 text-center">
        {brandName ? (
          <p className="type-fine-print text-[var(--ink-muted-48)]">{brandName}</p>
        ) : null}
        <h1 className="type-tagline text-[var(--ink)]">Página indisponível</h1>
        <p className="type-caption text-[var(--ink-muted-80)]">
          Esta página não está disponível no momento.
        </p>
      </div>
    </main>
  );
}
