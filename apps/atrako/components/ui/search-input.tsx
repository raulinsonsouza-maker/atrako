import * as React from "react";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";

export type SearchInputSize = "toolbar" | "field";

export interface SearchInputProps extends Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type" | "size"
> {
  /** `toolbar` = h-9 filtros; `field` = h-11 formulários (default) */
  size?: SearchInputSize;
}

/**
 * Busca canônica do produto (YAML: search-input).
 * Sempre este componente — nunca input de busca reinventado na page.
 */
const SearchInput = React.forwardRef<HTMLInputElement, SearchInputProps>(
  (
    {
      className,
      size = "field",
      placeholder = "Buscar…",
      "aria-label": ariaLabel = "Buscar",
      ...props
    },
    ref,
  ) => {
    const isToolbar = size === "toolbar";
    return (
      <div className="relative w-full">
        <Search
          className={cn(
            "pointer-events-none absolute top-1/2 -translate-y-1/2 text-[var(--ink-muted-48)]",
            isToolbar ? "left-3.5 h-3.5 w-3.5" : "left-4 h-3.5 w-3.5",
          )}
          strokeWidth={1.75}
          aria-hidden
        />
        <input
          ref={ref}
          type="search"
          aria-label={ariaLabel}
          placeholder={placeholder}
          className={cn(
            "w-full rounded-pill border border-[rgba(0,0,0,0.08)] bg-[var(--canvas)] text-[var(--ink)] outline-none focus:border-[var(--primary-focus)] focus:outline focus:outline-2 focus:outline-offset-2 focus:outline-[var(--primary-focus)]",
            isToolbar
              ? "h-9 py-1.5 pl-9 pr-4 type-caption"
              : "h-11 py-3 pl-10 pr-5 type-body",
            className,
          )}
          {...props}
        />
      </div>
    );
  },
);
SearchInput.displayName = "SearchInput";

export { SearchInput };
