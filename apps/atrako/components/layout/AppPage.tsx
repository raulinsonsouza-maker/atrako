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
          "flex min-h-0 w-full flex-1 flex-col gap-4 px-5 py-5 md:gap-4 md:px-6 md:py-5",
          narrow && "mx-auto max-w-3xl",
          className,
        )}
      >
        {title != null || actions ? (
          <header className="flex shrink-0 items-center justify-between gap-3">
            {title != null ? (
              typeof title === "string" ? (
                <h1 className="type-tagline text-[var(--ink)]">{title}</h1>
              ) : (
                title
              )
            ) : (
              <span />
            )}
            {actions ? <div className="flex shrink-0 items-center gap-2">{actions}</div> : null}
          </header>
        ) : null}
        {children}
      </div>
    </div>
  );
}
