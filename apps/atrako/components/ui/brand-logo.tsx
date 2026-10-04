import { cn } from "@/lib/utils";
import { BRAND_ICONS } from "./brand-icons.data";

/** Marcas sem ícone no simple-icons: monograma nas cores da marca. */
const MONOGRAMS: Record<string, { label: string; bg: string; fg: string }> = {
  LINKEDIN_ADS: { label: "in", bg: "#0A66C2", fg: "#ffffff" },
  MERCADO_LIVRE: { label: "ML", bg: "#FFE600", fg: "#2D3277" },
  NUVEMSHOP: { label: "N", bg: "#2C3357", fg: "#ffffff" },
  TRAY: { label: "T", bg: "#1d1d1f", fg: "#ffffff" },
};

/**
 * Logo de parceiro (YAML: brand-logo) — tile quadrado com a marca em cores oficiais.
 * Só para identificar integrações de terceiros; nunca como accent do produto.
 */
export function BrandLogo({
  provider,
  size = 36,
  className,
}: {
  provider: string;
  size?: number;
  className?: string;
}) {
  const icon = BRAND_ICONS[provider];
  const mono = MONOGRAMS[provider];
  const bg = icon?.hex ?? mono?.bg ?? "var(--surface-pearl)";

  return (
    <span
      className={cn("inline-flex shrink-0 items-center justify-center rounded-[10px]", className)}
      style={{ width: size, height: size, background: bg }}
      aria-hidden
    >
      {icon ? (
        <svg
          viewBox="0 0 24 24"
          width={Math.round(size * 0.6)}
          height={Math.round(size * 0.6)}
          fill="#ffffff"
        >
          <path d={icon.path} />
        </svg>
      ) : (
        <span
          className="type-caption-strong leading-none"
          style={{ color: mono?.fg ?? "var(--ink)" }}
        >
          {mono?.label ?? provider.slice(0, 1)}
        </span>
      )}
    </span>
  );
}
