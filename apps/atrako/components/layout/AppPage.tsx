import { cn } from "@/lib/utils";

/**
 * Shell padrão das páginas do App (ao lado da sidebar).
 * Tipografia e padding densos — evita conteúdo “grande” vs menu “pequeno”.
 */
export function AppPage({
  title,
  actions,
  children,
  className,
  /** Formulários / config estreitos. Módulos (CRM, WA…) usam full width. */
  narrow,
}: {
  title?: React.ReactNode;
  actions?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  narrow?: boolean;
}) {
  return (
    <div className="flex min-h-0 flex-1 flex-col bg-[var(--canvas-parchment)]">
      <div
        className={cn(
          "flex min-h-0 w-full flex-1 flex-col gap-4 px-4 py-4 md:gap-4 md:px-6 md:py-5",
          narrow && "mx-auto max-w-3xl",
          className,
        )}
      >
        {title != null || actions ? (
          <header className="flex shrink-0 flex-col items-stretch gap-3 md:flex-row md:items-center md:justify-between">
            {title != null ? (
              typeof title === "string" ? (
                <h1 className="type-tagline text-[var(--ink)]">{title}</h1>
              ) : (
                title
              )
            ) : (
              <span className="hidden md:block" />
            )}
            {actions ? <div className="flex min-w-0 items-center gap-2 md:shrink-0">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}
